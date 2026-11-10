import { test, expect } from '@playwright/test';

test.describe('TC01 - Authentication (Đăng nhập/Đăng ký)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC01_01: Mở Modal Auth và kiểm tra Validation Email', async ({ page }) => {
    await page.locator('text=Đăng nhập').first().click();
    await expect(page.locator('.ant-modal')).toBeVisible();
    
    // Test input sai format
    await page.fill('input[type="email"]', 'invalid_email');
    await page.click('button:has-text("Tiếp tục")');
    await expect(page.locator('.ant-form-item-has-error')).toBeVisible();
  });

  test('TC01_02: Chuyển đổi giữa Đăng nhập và Đăng ký', async ({ page }) => {
    await page.locator('text=Đăng nhập').first().click();
    await page.locator('text=Tạo tài khoản').click();
    await expect(page.locator('text=Đăng ký tài khoản')).toBeVisible();
  });
});
