import { useState, useEffect, useCallback } from 'react';
import {
  Table, Tag, Button, Select, Input, Card, Row, Col, Statistic,
  Modal, Tooltip, Badge, Space, Typography, Alert, Empty, Spin,
  Popconfirm, message as antMessage,
} from 'antd';
import {
  RobotOutlined, MessageOutlined, AlertOutlined, CheckCircleOutlined,
  SyncOutlined, DownloadOutlined, PlayCircleOutlined, UserOutlined,
  ClockCircleOutlined, BarChartOutlined, ReloadOutlined, FilterOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;
const API = '';  // relative path, same origin

// ─── Danh sách 48 Intent labels ─────────────────────────────────────────────
const INTENT_OPTIONS = [
  'GREETING', 'HELP', 'CONTACT', 'SMALLTALK', 'FEEDBACK_POSITIVE',
  'SEARCH_PRODUCT', 'SEARCH_CATEGORY', 'ASK_PRICE', 'ASK_SPECS', 'ASK_ACCESSORIES',
  'ASK_RECOMMEND', 'ASK_BEST_SELLER', 'ASK_NEW_ARRIVAL', 'ASK_PREORDER',
  'ASK_CAMERA', 'ASK_BATTERY', 'ASK_DISPLAY', 'ASK_STORAGE', 'ASK_CONNECTIVITY',
  'ASK_GAMING', 'ASK_WATERPROOF', 'ASK_OS', 'ASK_DESIGN', 'ASK_COMPATIBILITY',
  'ASK_PROMO', 'ASK_DELIVERY', 'ASK_RETURN', 'ASK_PAYMENT', 'ASK_REVIEW',
  'ASK_INVOICE', 'ASK_GIFT', 'ASK_GIFT_WRAP', 'ASK_LOYALTY',
  'ASK_SECOND_HAND', 'ASK_AUTHENTIC', 'ASK_TRADE_IN', 'ASK_REPAIR',
  'COMPARE_PRODUCT', 'COMPARE_SPECS', 'COMPARE_ACCESSORIES',
  'CHECK_STOCK', 'TRACK_ORDER', 'CANCEL_ORDER', 'CHANGE_PRODUCT',
  'PRICE_COMPLAINT', 'COMPLAINT', 'BULK_ORDER', 'URGENT_NEED', 'UNKNOWN',
];

// Màu sắc cho từng nhóm Intent
const INTENT_COLOR = {
  GREETING: 'green', HELP: 'green', CONTACT: 'green', SMALLTALK: 'green', FEEDBACK_POSITIVE: 'cyan',
  SEARCH_PRODUCT: 'blue', SEARCH_CATEGORY: 'blue', ASK_PRICE: 'blue', ASK_SPECS: 'blue',
  ASK_RECOMMEND: 'geekblue', ASK_BEST_SELLER: 'geekblue', ASK_NEW_ARRIVAL: 'geekblue',
  ASK_PROMO: 'orange', ASK_DELIVERY: 'orange', ASK_RETURN: 'orange', ASK_PAYMENT: 'orange',
  COMPARE_PRODUCT: 'purple', COMPARE_SPECS: 'purple',
  CHECK_STOCK: 'volcano', TRACK_ORDER: 'volcano', CANCEL_ORDER: 'volcano',
  PRICE_COMPLAINT: 'red', COMPLAINT: 'red',
  UNKNOWN: 'default',
};

function getIntentColor(intent) {
  return INTENT_COLOR[intent] || 'default';
}

function scoreToPercent(score) {
  return Math.round((score || 0) * 100);
}

function ScoreBadge({ score }) {
  const pct = scoreToPercent(score);
  const color = pct >= 70 ? '#52c41a' : pct >= 40 ? '#faad14' : '#ff4d4f';
  return (
    <span style={{ fontWeight: 600, color }}>
      {pct}%
    </span>
  );
}

// ─── Component Chính ─────────────────────────────────────────────────────────
export default function ChatbotManagement() {
  const [logs, setLogs]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters]     = useState({ onlyUnknown: false, onlyUnannotated: false, intent: '' });
  const [trainLoading, setTrainLoading] = useState(false);
  const [annotatingId, setAnnotatingId] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);  // For detail modal
  const token = localStorage.getItem('token');

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // ── Fetch stats ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`${API}/api/b2b/chat-logs/stats`, { headers: authHeaders });
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Stats error:', e);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Fetch logs ───────────────────────────────────────────────
  const fetchLogs = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit: pageSize,
        ...(filters.intent && { intent: filters.intent }),
        ...(filters.onlyUnknown && { onlyUnknown: 'true' }),
        ...(filters.onlyUnannotated && { onlyUnannotated: 'true' }),
      });
      const res  = await fetch(`${API}/api/b2b/chat-logs?${params}`, { headers: authHeaders });
      const data = await res.json();
      setLogs(data.data || []);
      setPagination(p => ({ ...p, current: page, pageSize, total: data.pagination?.total || 0 }));
    } catch (e) {
      antMessage.error('Không thể tải dữ liệu chat log');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchStats(); fetchLogs(); }, []);
  useEffect(() => { fetchLogs(1, pagination.pageSize); }, [filters]);

  // ── Annotate (gán nhãn lại Intent) ──────────────────────────
  const handleAnnotate = async (logId, correctedIntent) => {
    setAnnotatingId(logId);
    try {
      const res = await fetch(`${API}/api/b2b/chat-logs/${logId}/annotate`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ corrected_intent: correctedIntent }),
      });
      if (!res.ok) throw new Error('Lỗi cập nhật');
      antMessage.success(`Đã gán nhãn: ${correctedIntent}`);
      setLogs(prev => prev.map(l => l.id === logId
        ? { ...l, corrected_intent: correctedIntent, is_annotated: true }
        : l
      ));
      fetchStats();
    } catch (e) {
      antMessage.error('Không thể cập nhật nhãn');
    } finally {
      setAnnotatingId(null);
    }
  };

  // ── Trigger MLOps Train ──────────────────────────────────────
  const handleTriggerTrain = async () => {
    setTrainLoading(true);
    try {
      const res  = await fetch(`${API}/api/b2b/trigger-ai-train`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        antMessage.warning(data.error || 'Không đủ dữ liệu để train');
        return;
      }
      antMessage.success(`🚀 MLOps Pipeline đã khởi động! Dataset: ${data.dataset_size} câu.`);
      fetchStats();
      fetchLogs(pagination.current, pagination.pageSize);
    } catch (e) {
      antMessage.error('Lỗi khi kích hoạt pipeline');
    } finally {
      setTrainLoading(false);
    }
  };

  // ── Export dataset ───────────────────────────────────────────
  const handleExport = () => {
    window.open(`${API}/api/b2b/chat-logs/export`, '_blank');
  };

  // ─── Table Columns ──────────────────────────────────────────
  const columns = [
    {
      title: '#',
      dataIndex: 'id',
      width: 70,
      render: (_, __, i) => <Text type="secondary" style={{ fontSize: 12 }}>#{i + 1 + (pagination.current - 1) * pagination.pageSize}</Text>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      width: 140,
      render: v => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{new Date(v).toLocaleDateString('vi-VN')}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{new Date(v).toLocaleTimeString('vi-VN')}</Text>
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer',
      width: 160,
      render: (customer, record) => customer ? (
        <Space direction="vertical" size={0}>
          <Space>
            <UserOutlined style={{ color: '#10b981' }} />
            <Text strong style={{ fontSize: 12 }}>{customer.full_name}</Text>
          </Space>
          <Text type="secondary" style={{ fontSize: 11 }}>{customer.email}</Text>
          {customer.phone && <Text type="secondary" style={{ fontSize: 11 }}>{customer.phone}</Text>}
        </Space>
      ) : (
        <Space>
          <UserOutlined style={{ color: '#999' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>Khách ẩn danh</Text>
          <Tooltip title={`Session: ${record.session_id}`}>
            <Text type="secondary" style={{ fontSize: 11, cursor: 'help' }}>
              {record.session_id?.slice(0, 12)}...
            </Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Tin nhắn khách',
      dataIndex: 'message',
      ellipsis: true,
      render: (msg, record) => (
        <Tooltip title="Click để xem chi tiết">
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => setSelectedLog(record)}
          >
            {msg}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Intent AI',
      dataIndex: 'intent',
      width: 170,
      render: (intent, record) => (
        <Space direction="vertical" size={2}>
          <Tag color={getIntentColor(intent)} style={{ fontSize: 11, margin: 0 }}>
            {intent}
          </Tag>
          <ScoreBadge score={record.score} />
          {record.is_annotated && record.corrected_intent && record.corrected_intent !== intent && (
            <Tag color="success" style={{ fontSize: 10, margin: 0 }}>
              ✅ {record.corrected_intent}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Gán nhãn (Annotation)',
      width: 200,
      render: (_, record) => (
        <Select
          size="small"
          style={{ width: 190 }}
          placeholder="Sửa Intent..."
          defaultValue={record.corrected_intent || undefined}
          loading={annotatingId === record.id}
          onChange={(val) => handleAnnotate(record.id, val)}
          options={INTENT_OPTIONS.map(i => ({ value: i, label: i }))}
          showSearch
          optionFilterProp="label"
        />
      ),
    },
    {
      title: 'Trạng thái',
      width: 110,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          {record.is_annotated
            ? <Badge status="success" text={<Text style={{ fontSize: 11 }}>Đã xem xét</Text>} />
            : <Badge status="default" text={<Text style={{ fontSize: 11 }}>Chưa xem</Text>} />}
          {record.is_trained
            ? <Badge status="processing" text={<Text style={{ fontSize: 11 }}>Đã train</Text>} />
            : null}
        </Space>
      ),
    },
  ];

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Space>
            <RobotOutlined style={{ fontSize: 28, color: '#10b981' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>Quản Lý Chatbot AI</Title>
              <Text type="secondary">MLOps Dashboard — Theo dõi và huấn luyện lại Model</Text>
            </div>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchLogs(pagination.current, pagination.pageSize); }}>
              Làm mới
            </Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Xuất Dataset
            </Button>
            <Popconfirm
              title="Kích hoạt MLOps Pipeline?"
              description={`Sẽ dùng ${stats?.pendingTrainCount || 0} câu mới để train lại model AI.`}
              onConfirm={handleTriggerTrain}
              okText="🚀 Khởi động"
              cancelText="Huỷ"
              disabled={!stats?.canTriggerTrain}
            >
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={trainLoading}
                disabled={!stats?.canTriggerTrain}
                style={{
                  background: stats?.canTriggerTrain ? 'linear-gradient(135deg, #10b981, #059669)' : undefined,
                  border: 'none',
                }}
              >
                🚀 Khởi chạy Train Model
                {stats?.pendingTrainCount > 0 && (
                  <Badge count={stats.pendingTrainCount} style={{ marginLeft: 6, backgroundColor: '#fff', color: '#10b981' }} />
                )}
              </Button>
            </Popconfirm>
          </Space>
        </Col>
      </Row>

      {/* Thông báo khi chưa đủ data để train */}
      {stats && !stats.canTriggerTrain && stats.pendingTrainCount < 10 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Cần ít nhất 10 câu được gán nhãn để kích hoạt Train. Hiện có: ${stats.pendingTrainCount} câu.`}
          description="Hãy gán nhãn (Annotation) cho các câu UNKNOWN bên dưới để chuẩn bị dữ liệu train."
        />
      )}

      {/* Statistics Cards */}
      <Spin spinning={statsLoading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" hoverable>
              <Statistic
                title="Tổng cuộc chat"
                value={stats?.totalLogs || 0}
                prefix={<MessageOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff', fontSize: 22 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" hoverable>
              <Statistic
                title="Câu UNKNOWN"
                value={stats?.unknownCount || 0}
                suffix={<Text type="secondary" style={{ fontSize: 12 }}>({stats?.unknownRate || 0}%)</Text>}
                prefix={<AlertOutlined style={{ color: '#ff4d4f' }} />}
                valueStyle={{ color: '#ff4d4f', fontSize: 22 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" hoverable>
              <Statistic
                title="Chờ gán nhãn"
                value={stats?.unannotatedCount || 0}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14', fontSize: 22 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" hoverable>
              <Statistic
                title="Sẵn sàng Train"
                value={stats?.pendingTrainCount || 0}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontSize: 22 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={16} md={8}>
            <Card size="small" hoverable style={{ height: '100%' }}>
              <Text strong><BarChartOutlined /> Top Intent</Text>
              <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(stats?.topIntents || []).slice(0, 6).map(i => (
                  <Tag key={i.intent} color={getIntentColor(i.intent)} style={{ fontSize: 11 }}>
                    {i.intent} <strong>({i.count})</strong>
                  </Tag>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* Bộ lọc */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col>
            <FilterOutlined style={{ color: '#10b981' }} />
            <Text strong style={{ marginLeft: 6 }}>Lọc:</Text>
          </Col>
          <Col>
            <Select
              value={filters.intent || undefined}
              placeholder="Lọc theo Intent"
              allowClear
              style={{ width: 200 }}
              onChange={v => setFilters(f => ({ ...f, intent: v || '' }))}
              options={INTENT_OPTIONS.map(i => ({ value: i, label: i }))}
              showSearch
            />
          </Col>
          <Col>
            <Button
              type={filters.onlyUnknown ? 'primary' : 'default'}
              danger={filters.onlyUnknown}
              size="small"
              onClick={() => setFilters(f => ({ ...f, onlyUnknown: !f.onlyUnknown }))}
            >
              Chỉ UNKNOWN
            </Button>
          </Col>
          <Col>
            <Button
              type={filters.onlyUnannotated ? 'primary' : 'default'}
              size="small"
              onClick={() => setFilters(f => ({ ...f, onlyUnannotated: !f.onlyUnannotated }))}
            >
              Chưa gán nhãn
            </Button>
          </Col>
          <Col>
            <Button
              size="small"
              onClick={() => setFilters({ onlyUnknown: false, onlyUnannotated: false, intent: '' })}
            >
              Xóa lọc
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Bảng ChatLog */}
      <Card>
        <Table
          rowKey="id"
          dataSource={logs}
          columns={columns}
          loading={loading}
          size="small"
          scroll={{ x: 1200 }}
          rowClassName={record =>
            record.intent === 'UNKNOWN' && !record.is_annotated
              ? 'ant-table-row-unknown'
              : ''
          }
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (total) => `Tổng ${total} cuộc hội thoại`,
            onChange: (page, size) => {
              setPagination(p => ({ ...p, current: page, pageSize: size }));
              fetchLogs(page, size);
            },
          }}
          locale={{ emptyText: <Empty description="Chưa có lịch sử chat nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        />
      </Card>

      {/* Modal Chi Tiết Cuộc Chat */}
      <Modal
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={640}
        title={
          <Space>
            <MessageOutlined style={{ color: '#10b981' }} />
            Chi tiết cuộc hội thoại
          </Space>
        }
      >
        {selectedLog && (
          <div>
            {/* Thông tin người dùng */}
            <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Row gutter={12}>
                <Col span={12}>
                  <Text type="secondary">Khách hàng:</Text><br />
                  <Text strong>
                    {selectedLog.customer
                      ? `${selectedLog.customer.full_name} (${selectedLog.customer.email})`
                      : 'Khách ẩn danh'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Thời gian:</Text><br />
                  <Text strong>{new Date(selectedLog.created_at).toLocaleString('vi-VN')}</Text>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <Text type="secondary">Session ID:</Text><br />
                  <Text code style={{ fontSize: 11 }}>{selectedLog.session_id}</Text>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <Text type="secondary">Nguồn phân loại:</Text><br />
                  <Tag color="blue">{selectedLog.source}</Tag>
                </Col>
              </Row>
            </Card>

            {/* Nội dung chat */}
            <div style={{ marginBottom: 12 }}>
              <div style={{
                background: '#e6f4ff', borderRadius: 12, padding: '10px 14px',
                marginBottom: 8, maxWidth: '80%'
              }}>
                <Text type="secondary" style={{ fontSize: 11 }}>👤 Khách hàng:</Text>
                <p style={{ margin: 0, marginTop: 4 }}>{selectedLog.message}</p>
              </div>
              <div style={{
                background: '#f6ffed', borderRadius: 12, padding: '10px 14px',
                marginLeft: 'auto', maxWidth: '80%'
              }}>
                <Text type="secondary" style={{ fontSize: 11 }}>🤖 AI Chatbot:</Text>
                <p style={{ margin: 0, marginTop: 4, whiteSpace: 'pre-wrap' }}>{selectedLog.response}</p>
              </div>
            </div>

            {/* Intent & Annotation */}
            <Card size="small">
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">Intent AI nhận diện:</Text><br />
                  <Tag color={getIntentColor(selectedLog.intent)} style={{ marginTop: 4 }}>
                    {selectedLog.intent}
                  </Tag>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    Độ tự tin: <ScoreBadge score={selectedLog.score} />
                  </Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Gán nhãn đúng:</Text><br />
                  <Select
                    style={{ width: '100%', marginTop: 4 }}
                    placeholder="Chọn Intent đúng..."
                    defaultValue={selectedLog.corrected_intent || undefined}
                    onChange={(val) => {
                      handleAnnotate(selectedLog.id, val);
                      setSelectedLog(s => ({ ...s, corrected_intent: val, is_annotated: true }));
                    }}
                    options={INTENT_OPTIONS.map(i => ({ value: i, label: i }))}
                    showSearch
                  />
                </Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>

      {/* Style cho dòng UNKNOWN */}
      <style>{`
        .ant-table-row-unknown {
          background: #fff2f0 !important;
        }
        .ant-table-row-unknown:hover > td {
          background: #fff1f0 !important;
        }
      `}</style>
    </div>
  );
}
