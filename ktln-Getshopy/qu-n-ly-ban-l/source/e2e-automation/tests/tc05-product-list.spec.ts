import { test, expect } from '@playwright/test';

test.describe('TC05 - Bộ lọc Sản phẩm (Product List)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
  });

  test('TC05_01: Lọc theo Mức giá (Slider)', async ({ page }) => {
    // Kéo thanh trượt hoặc nhập min max
    // Tùy theo UI, giả lập click vào checkbox giá hoặc radio
    const filterRadio = page.locator('input[type="radio"]').first();
    await filterRadio.check();
    
    // Chờ Skeleton loading kết thúc
    await expect(page.locator('.ant-skeleton')).not.toBeVisible();
    // Đảm bảo card vẫn render
    await expect(page.locator('.ant-card').first()).toBeVisible();
  });

  test('TC05_02: Phân trang (Pagination)', async ({ page }) => {
    const page2 = page.locator('.ant-pagination-item-2');
    if (await page2.isVisible()) {
      await page2.click();
      await expect(page).toHaveURL(/.*page=2/);
    }
  });
});
