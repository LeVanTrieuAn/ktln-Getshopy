#!/usr/bin/env node
/**
 * API Key & Model Validation Script
 * Kiểm tra từng API key + model có hoạt động không
 */

const colors = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  dim:   s => `\x1b[2m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
};

async function test(name, fn) {
  const s = Date.now();
  try {
    const result = await fn();
    console.log(`${colors.green('✓')} ${name} ${colors.dim(`(${Date.now()-s}ms)`)}`);
    if (result) console.log(`  ${colors.dim(result)}`);
    return true;
  } catch(e) {
    console.log(`${colors.red('✗')} ${name} ${colors.dim(`(${Date.now()-s}ms)`)}`);
    console.log(`  ${colors.red(e.message)}`);
    return false;
  }
}

async function main() {
  console.log(colors.bold('\n🔑 API Key & Model Validation\n'));

  // ── 1. HuggingFace mDeBERTa (Intent Classification) ──
  const HF_API_KEY = process.env.HF_API_KEY;
  const HF_MODEL = process.env.HF_MODEL || 'MoritzLaurer/mDeBERTa-v3-base-mnli-xnli';
  
  await test(`1. HuggingFace API Key (${HF_API_KEY?.slice(0,10)}...)`, async () => {
    if (!HF_API_KEY) throw new Error('HF_API_KEY not set!');
    const r = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: 'Tìm iPhone 16 Pro Max',
        parameters: { candidate_labels: ['search_product', 'greeting', 'price_inquiry'] }
      }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    if (d.error) throw new Error(`HF Error: ${d.error}`);
    if (!d.labels) throw new Error(`Unexpected response: ${JSON.stringify(d).slice(0,200)}`);
    return `Model: ${HF_MODEL} | Top label: "${d.labels[0]}" (${(d.scores[0]*100).toFixed(1)}%)`;
  });

  // ── 2. HuggingFace Qwen LLM (Text Generation) ──
  const HF_LLM_MODEL = process.env.HF_LLM_MODEL || 'Qwen/Qwen2.5-7B-Instruct';
  
  await test(`2. HuggingFace LLM (${HF_LLM_MODEL})`, async () => {
    if (!HF_API_KEY) throw new Error('HF_API_KEY not set!');
    const r = await fetch(`https://api-inference.huggingface.co/models/${HF_LLM_MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: '<|im_start|>user\nXin chào<|im_end|>\n<|im_start|>assistant\n',
        parameters: { max_new_tokens: 50, return_full_text: false }
      }),
      signal: AbortSignal.timeout(30000),
    });
    const d = await r.json();
    if (d.error) throw new Error(`LLM Error: ${d.error}`);
    const text = Array.isArray(d) ? d[0]?.generated_text : d.generated_text;
    if (!text) throw new Error(`Unexpected: ${JSON.stringify(d).slice(0,200)}`);
    return `Response: "${text.trim().slice(0,100)}"`;
  });

  // ── 3. Google AI (Gemini Vision) ──
  const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
  
  await test(`3. Google AI Key (Gemini Vision) (${GOOGLE_AI_KEY?.slice(0,10)}...)`, async () => {
    if (!GOOGLE_AI_KEY) throw new Error('GOOGLE_AI_KEY not set!');
    // Simple text-only test to validate key
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say "OK" in one word' }] }],
          generationConfig: { maxOutputTokens: 10 }
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const d = await r.json();
    if (d.error) throw new Error(`Gemini Error: ${d.error.message} (code: ${d.error.code})`);
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Unexpected: ${JSON.stringify(d).slice(0,200)}`);
    return `Gemini responds: "${text.trim()}"`;
  });

  // ── 4. OpenRouter (Backup LLM) ──
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1';
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  
  await test(`4. OpenRouter Key (${OPENROUTER_MODEL})`, async () => {
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set!');
    const r = await fetch(`${OPENROUTER_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const d = await r.json();
    if (d.error) throw new Error(`OpenRouter Error: ${JSON.stringify(d.error)}`);
    const text = d.choices?.[0]?.message?.content;
    if (!text) throw new Error(`Unexpected: ${JSON.stringify(d).slice(0,200)}`);
    return `Model: ${OPENROUTER_MODEL} | Response: "${text.trim()}"`;
  });

  // ── 5. Database (Prisma/PostgreSQL) ──
  await test('5. PostgreSQL Database (Prisma)', async () => {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const count = await prisma.product.count();
      return `Connected! Products: ${count}`;
    } finally {
      await prisma.$disconnect();
    }
  });

  // ── 6. Redis ──
  await test('6. Redis Cache', async () => {
    const { createClient } = require('redis');
    const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
    try {
      await redis.connect();
      await redis.set('test_key', 'ok');
      const val = await redis.get('test_key');
      await redis.del('test_key');
      return `Connected! Test: ${val}`;
    } finally {
      await redis.quit();
    }
  });

  console.log(colors.bold('\n✅ Validation complete\n'));
}

main().catch(e => { console.error(colors.red(e.message)); process.exit(1); });
