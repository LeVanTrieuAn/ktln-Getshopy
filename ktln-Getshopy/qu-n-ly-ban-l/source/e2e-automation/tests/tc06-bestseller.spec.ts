import { test, expect } from '@playwright/test';

test.describe('TC06 - Sản Phẩm Bán Chạy (Bestseller)', () => {
  test('TC06_01: Kiểm tra Badge và Tag Bán chạy', async ({ page }) => {
    await page.goto('/bestsellers'); // Giả định Route
    
    const card = page.locator('.ant-card').first();
    await expect(card).toBeVisible();
    
    // Card phải chứa chữ Bán chạy hoặc Icon Hot
    await expect(card.locator('.ant-badge')).toBeVisible();
  });
});
