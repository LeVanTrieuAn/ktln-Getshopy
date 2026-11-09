'use strict';
process.env.DATABASE_URL = "postgresql://getshopy:getshopy_dev_password@localhost:5432/getshopy";
process.env.JWT_SECRET = "istore_super_secret_jwt_key_2024";
process.env.HF_API_KEY = "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";
process.env.HF_LLM_MODEL = "Qwen/Qwen2.5-7B-Instruct";
const ChatbotService = require('../src/services/ChatbotService');

async function test() {
  try {
    console.log('Testing ChatbotService.chat with: "Tôi muốn mua điện thoại"...');
    const res = await ChatbotService.chat({ message: 'Tôi muốn mua điện thoại', history: [] });
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Error in chat:', err);
  }
}

test();
