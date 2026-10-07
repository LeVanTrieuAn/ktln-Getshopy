import { test, expect } from '@playwright/test';

test.describe('TC02 - Sidebar & Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC02_01: Điều hướng các menu chính trên Sidebar', async ({ page }) => {
    const menus = ['Cửa hàng', 'Sản phẩm mới', 'Bán chạy nhất'];
    
    for (const menu of menus) {
      await page.locator(`a:has-text("${menu}")`).first().click();
      // Chờ URL thay đổi hoặc giao diện tương ứng render
      await expect(page).not.toHaveURL('about:blank');
    }
  });

  test('TC02_02: Responsive - Đóng mở Drawer trên Mobile', async ({ page }) => {
    // Giả lập màn hình mobile
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Click nút Hamburger menu
    await page.locator('.anticon-menu').click();
    await expect(page.locator('.ant-drawer-open')).toBeVisible();
    
    // Đóng Drawer
    await page.locator('.ant-drawer-close').click();
    await expect(page.locator('.ant-drawer-open')).not.toBeVisible();
  });
});
