'use strict';
/**
 * ============================================================
 * AI ADMIN API — Quản Lý Chatbot & MLOps Pipeline
 * routes/aiAdmin.js — Getshopy Admin Panel
 * ============================================================
 *
 * Các endpoint trong file này chỉ dành cho Admin (B2B).
 * Cung cấp:
 *   1. Xem toàn bộ lịch sử chat (ChatLog) kèm thông tin User
 *   2. Sửa Intent bị phân loại sai (Data Annotation cho MLOps)
 *   3. Kích hoạt quá trình Train lại model (Trigger MLOps Pipeline)
 *   4. Thống kê tổng quan về Chatbot AI
 */

const express = require('express');
const { prisma } = require('../db');
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/b2b/chat-logs
//    Lấy danh sách chat log, kèm thông tin khách hàng (nếu có đăng nhập)
//    Query params:
//      - page (default: 1)
//      - limit (default: 20)
//      - intent (filter by intent, optional)
//      - onlyUnknown=true (chỉ lấy câu UNKNOWN để dễ gán nhãn)
//      - onlyUnannotated=true (chỉ lấy câu chưa được Admin review)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chat-logs', async (req, res) => {
  try {
    const page          = Math.max(1, parseInt(req.query.page)  || 1);
    const limit         = Math.min(100, parseInt(req.query.limit) || 20);
    const skip          = (page - 1) * limit;
    const intentFilter  = req.query.intent;
    const onlyUnknown   = req.query.onlyUnknown   === 'true';
    const onlyUnannotated = req.query.onlyUnannotated === 'true';

    const where = {};
    if (intentFilter)   where.intent       = intentFilter;
    if (onlyUnknown)    where.intent       = 'UNKNOWN';
    if (onlyUnannotated) where.is_annotated = false;

    const [logs, total] = await Promise.all([
      prisma.chatLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.chatLog.count({ where }),
    ]);

    // Lấy thêm thông tin B2CCustomer cho những log có customer_id
    const customerIds = [...new Set(logs.filter(l => l.customer_id).map(l => l.customer_id))];
    let customerMap = {};
    if (customerIds.length > 0) {
      const customers = await prisma.b2CCustomer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, full_name: true, email: true, phone: true, avatar: true, created_at: true },
      });
      customerMap = Object.fromEntries(customers.map(c => [String(c.id), c]));
    }

    const enrichedLogs = logs.map(log => ({
      id:               String(log.id),
      session_id:       log.session_id,
      message:          log.message,
      response:         log.response,
      intent:           log.intent,
      corrected_intent: log.corrected_intent,
      score:            log.score,
      source:           log.source,
      is_annotated:     log.is_annotated,
      is_trained:       log.is_trained,
      created_at:       log.created_at,
      // Thông tin người dùng (nếu có)
      customer: log.customer_id ? (customerMap[String(log.customer_id)] || null) : null,
    }));

    res.json({
      data: enrichedLogs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[ChatLog API] GET Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/b2b/chat-logs/stats
//    Thống kê tổng quan về Chatbot AI (cho Dashboard MLOps)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chat-logs/stats', async (req, res) => {
  try {
    const [
      totalLogs,
      unknownCount,
      unannotatedCount,
      pendingTrainCount,
      intentCounts,
      recentActivity,
    ] = await Promise.all([
      prisma.chatLog.count(),
      prisma.chatLog.count({ where: { intent: 'UNKNOWN' } }),
      prisma.chatLog.count({ where: { is_annotated: false, intent: 'UNKNOWN' } }),
      prisma.chatLog.count({ where: { is_annotated: true, is_trained: false } }),
      // Top 10 intent phổ biến nhất
      prisma.chatLog.groupBy({
        by: ['intent'],
        _count: { intent: true },
        orderBy: { _count: { intent: 'desc' } },
        take: 10,
      }),
      // Lượng chat theo 7 ngày gần nhất
      prisma.$queryRaw`
        SELECT 
          DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') as date,
          COUNT(*)::int as count
        FROM "ChatLog"
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY date ORDER BY date ASC
      `,
    ]);

    res.json({
      totalLogs,
      unknownCount,
      unknownRate: totalLogs > 0 ? ((unknownCount / totalLogs) * 100).toFixed(1) : 0,
      unannotatedCount,
      pendingTrainCount,
      canTriggerTrain: pendingTrainCount >= 10, // Tối thiểu 10 câu mới được gán nhãn
      topIntents: intentCounts.map(i => ({ intent: i.intent, count: i._count.intent })),
      recentActivity,
    });
  } catch (err) {
    console.error('[ChatLog API] Stats Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PUT /api/b2b/chat-logs/:id/annotate
//    Admin sửa Intent bị phân loại sai (Data Annotation)
//    Body: { corrected_intent: "ASK_PRICE" }
// ─────────────────────────────────────────────────────────────────────────────
router.put('/chat-logs/:id/annotate', async (req, res) => {
  try {
    const { id } = req.params;
    const { corrected_intent } = req.body;

    if (!corrected_intent) {
      return res.status(400).json({ error: 'corrected_intent is required' });
    }

    const updated = await prisma.chatLog.update({
      where: { id: BigInt(id) },
      data: {
        corrected_intent,
        is_annotated: true,
      },
    });

    res.json({ success: true, id: String(updated.id), corrected_intent: updated.corrected_intent });
  } catch (err) {
    console.error('[ChatLog API] Annotate Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. POST /api/b2b/trigger-ai-train
//    Kích hoạt MLOps Pipeline (GitHub Actions hoặc chạy local)
//    Body: { confirm: true }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/trigger-ai-train', async (req, res) => {
  try {
    // Đếm số câu đã được gán nhãn nhưng chưa train
    const pendingCount = await prisma.chatLog.count({
      where: { is_annotated: true, is_trained: false }
    });

    if (pendingCount < 10) {
      return res.status(400).json({
        error: `Cần ít nhất 10 câu được gán nhãn để train. Hiện có: ${pendingCount} câu.`,
        pendingCount,
      });
    }

    // Export dataset cho MLOps pipeline
    const trainingData = await prisma.chatLog.findMany({
      where: { is_annotated: true, is_trained: false },
      select: { id: true, message: true, corrected_intent: true },
    });

    const dataset = trainingData.map(row => ({
      text:  row.message,
      label: row.corrected_intent,
    }));

    // === TRIGGER GITHUB ACTIONS (Nếu có cấu hình) ===
    const ghToken  = process.env.GITHUB_TOKEN;
    const ghRepo   = process.env.GITHUB_REPO; // VD: 'levantrieu/getshopy'
    let triggerResult = { method: 'local_export', status: 'ready' };

    if (ghToken && ghRepo) {
      try {
        const triggerRes = await fetch(
          `https://api.github.com/repos/${ghRepo}/actions/workflows/mlops-pipeline.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${ghToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({
              ref: 'main',
              inputs: { dataset_size: String(dataset.length) }
            }),
          }
        );
        triggerResult = {
          method: 'github_actions',
          status: triggerRes.ok ? 'triggered' : 'failed',
          statusCode: triggerRes.status,
        };
      } catch (ghErr) {
        triggerResult = { method: 'github_actions', status: 'error', error: ghErr.message };
      }
    }

    // Đánh dấu các câu đã được đưa vào pipeline train
    if (triggerResult.status === 'triggered' || triggerResult.status === 'ready') {
      await prisma.chatLog.updateMany({
        where: { id: { in: trainingData.map(r => r.id) } },
        data: { is_trained: true },
      });
    }

    res.json({
      success: true,
      message: `Đã kích hoạt MLOps Pipeline với ${dataset.length} câu dữ liệu mới!`,
      dataset_size: dataset.length,
      trigger: triggerResult,
      // Trả về dataset để client có thể tải về nếu cần
      dataset_preview: dataset.slice(0, 5),
    });
  } catch (err) {
    console.error('[MLOps Trigger] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GET /api/b2b/chat-logs/export
//    Xuất toàn bộ dataset training dạng JSON (để tải về và dùng trên Colab)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/chat-logs/export', async (req, res) => {
  try {
    const rows = await prisma.chatLog.findMany({
      where: { is_annotated: true },
      select: { message: true, corrected_intent: true, intent: true, score: true },
      orderBy: { created_at: 'asc' },
    });

    const dataset = rows.map(r => ({
      text:  r.message,
      label: r.corrected_intent || r.intent,
    }));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=getshopy_training_dataset.json');
    res.json(dataset);
  } catch (err) {
    console.error('[Export] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
