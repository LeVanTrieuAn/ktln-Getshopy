import { test, expect } from '@playwright/test';

// File này bổ trợ thêm cho e2e-journey.spec.ts gốc
test.describe('TC12 - Hành Trình Xuyên Suốt', () => {
  test('TC12_01: Tìm kiếm -> Giỏ hàng -> Trở về trang chủ', async ({ page }) => {
    await page.goto('/');
    
    // Gõ tìm kiếm
    await page.fill('input[placeholder*="Tìm kiếm"]', 'Apple');
    await page.keyboard.press('Enter');
    
    // Chuyển sang /products?search=Apple
    await expect(page).toHaveURL(/.*search=Apple/);
    
    // Trở về trang chủ
    await page.locator('.logo').first().click();
    await expect(page).toHaveURL(/.*\/$/);
  });
});
