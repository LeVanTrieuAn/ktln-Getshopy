import { test, expect } from '@playwright/test';

test.describe('TC10 - Màn Hình Thanh Toán (Checkout)', () => {
  // Test này yêu cầu giỏ hàng phải có đồ.
  // Ta có thể inject localStorage trước khi chạy.
  
  test.use({
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:3000',
          localStorage: [
            {
              name: 'b2c_cart',
              value: '[{"id":1,"name":"Test","price":1000,"quantity":1,"selected":true}]'
            }
          ]
        }
      ]
    }
  });

  test('TC10_01: Điền Form giao hàng và Xác nhận COD', async ({ page }) => {
    await page.goto('/checkout');
    
    await page.fill('input[id="full_name"]', 'Khách Hàng Checkout');
    await page.fill('input[id="phone"]', '0901234567');
    
    // Bấm Confirm
    const submitBtn = page.locator('button', { hasText: 'Xác nhận đặt hàng' });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
    }
  });
});
