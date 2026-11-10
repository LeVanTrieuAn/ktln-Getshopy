import { test, expect } from '@playwright/test';

test.describe('TC11 - Hệ thống AI Chatbot', () => {
  test('TC11_01: ChatBot phản hồi Text Intent', async ({ page }) => {
    await page.goto('/');
    
    // Mở popup AI Chat (Giả định có widget chat ở góc dưới)
    const chatWidget = page.locator('.ai-chatbot-widget');
    if (await chatWidget.isVisible()) {
      await chatWidget.click();
      
      // Gõ text
      await page.fill('input[placeholder*="Hỏi AI"]', 'Tìm laptop asus');
      await page.keyboard.press('Enter');
      
      // Chờ bot trả lời
      await expect(page.locator('.bot-message')).toBeVisible({ timeout: 10000 });
    }
  });
});
