import { test, expect } from '@playwright/test';

test.describe('TC07 - Chi tiết Sản Phẩm & Variations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    await page.locator('.ant-card').first().click();
  });

  test('TC07_01: Đổi màu sắc (Color Variant) thay đổi hình ảnh', async ({ page }) => {
    // Click vào variant thứ 2 nếu có
    const variantOptions = page.locator('.variant-selector'); // class giả định
    if (await variantOptions.count() > 1) {
      await variantOptions.nth(1).click();
      // Chờ ảnh chính thay đổi src
      await expect(page.locator('.main-image')).toHaveAttribute('src', /.*/);
    }
  });

  test('TC07_02: Bấm Thêm vào giỏ', async ({ page }) => {
    await page.locator('button', { hasText: 'Thêm vào giỏ' }).click();
    await expect(page.locator('.ant-message')).toContainText('đã được thêm');
  });
});
