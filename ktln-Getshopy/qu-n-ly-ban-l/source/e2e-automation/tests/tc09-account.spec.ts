import { test, expect } from '@playwright/test';

test.describe('TC09 - Trang Hồ Sơ Cá Nhân (Account)', () => {
  test('TC09_01: Khách vãng lai tra cứu đơn hàng bằng Email', async ({ page }) => {
    await page.goto('/account');
    
    await page.fill('input[placeholder*="Nhập email"]', 'guest@getshopy.com');
    await page.click('button:has-text("Tra cứu")');
    
    // Nếu email sai, báo không tìm thấy
    await expect(page.locator('.ant-message')).toBeVisible();
  });
});
