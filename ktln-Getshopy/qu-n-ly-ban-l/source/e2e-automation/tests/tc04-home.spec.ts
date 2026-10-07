import { test, expect } from '@playwright/test';

test.describe('TC04 - Home Page & 3D Object', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC04_01: Render 3D Object trên Hero Banner', async ({ page }) => {
    // Kiểm tra Canvas của Three.js có được mount không
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC04_02: Section Gợi ý AI (AI Recommendation)', async ({ page }) => {
    const aiSection = page.locator('text=Dành riêng cho bạn');
    await expect(aiSection).toBeVisible();
    
    // Kiểm tra có ít nhất 1 product card được render
    await expect(page.locator('.ant-card').first()).toBeVisible();
  });
});
