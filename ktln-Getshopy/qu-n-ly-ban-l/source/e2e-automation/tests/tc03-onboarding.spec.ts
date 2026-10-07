import { test, expect } from '@playwright/test';

test.describe('TC03 - Onboarding Survey', () => {
  test('TC03_01: Bắt buộc chọn ít nhất 3 danh mục', async ({ page }) => {
    await page.goto('/onboarding');
    
    // Nhấn tiếp tục khi chưa chọn gì
    const nextBtn = page.locator('button:has-text("Hoàn tất")');
    await nextBtn.click();
    await expect(page.locator('.ant-message')).toContainText('Vui lòng chọn ít nhất 3 mục');
    
    // Chọn 3 mục
    const items = page.locator('.onboarding-item');
    if (await items.count() >= 3) {
      await items.nth(0).click();
      await items.nth(1).click();
      await items.nth(2).click();
      
      await nextBtn.click();
      await expect(page).toHaveURL('/');
    }
  });
});
