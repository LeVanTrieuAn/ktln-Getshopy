import { test, expect } from '@playwright/test';

test.describe('TC08 - So Sánh Thiết Bị (Compare)', () => {
  test('TC08_01: Thêm SP vào LocalStorage và hiển thị bảng', async ({ page }) => {
    // Mở trang sản phẩm, add 2 sản phẩm vào Compare
    await page.goto('/products');
    
    const compareBtns = page.locator('button[title="So sánh"]');
    if (await compareBtns.count() >= 2) {
      await compareBtns.nth(0).click();
      await compareBtns.nth(1).click();
    }
    
    // Vào trang so sánh
    await page.goto('/compare');
    
    // Bảng phải có 2 cột sản phẩm
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th.compare-item')).toHaveCount(2);
  });
});
