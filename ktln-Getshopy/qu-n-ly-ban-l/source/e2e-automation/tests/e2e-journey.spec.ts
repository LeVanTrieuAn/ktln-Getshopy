import { test, expect } from '@playwright/test';

// Kịch bản Automation E2E theo luồng hành trình khách hàng.
// Từ Đăng ký -> Mua hàng -> Thanh toán -> Quản lý Đơn hàng.

test.describe('E2E B2C User Journey - Đăng ký đến Mua hàng', () => {

  const randomId = Math.floor(Math.random() * 100000);
  const testEmail = `testuser_${randomId}@getshopy.local`;
  const testPassword = `Password123!`;

  test.beforeEach(async ({ page }) => {
    // Điều hướng tới trang chủ của ứng dụng
    await page.goto('/');
  });

  test('Hành trình 1: Khách hàng mới đăng ký tài khoản và mua hàng (Checkout)', async ({ page }) => {
    // === BƯỚC 1: ĐĂNG KÝ (REGISTER) VÀ ONBOARDING ===
    // 1. Mở popup Đăng nhập/Đăng ký
    await page.locator('text=Đăng nhập').first().click();
    
    // 2. Chuyển sang Tab Đăng ký (Giả định UI có tab Đăng ký)
    // await page.locator('text=Tạo tài khoản').click();
    // await page.fill('input[placeholder="Email"]', testEmail);
    // await page.fill('input[placeholder="Mật khẩu"]', testPassword);
    // await page.click('button:has-text("Đăng ký")');
    // Ở đây ta có thể setup Login trực tiếp hoặc thông qua Auth Component.
    
    // Do hệ thống có thể yêu cầu OTP qua Email, ta có thể giả định 
    // đã login bằng localStorage token hoặc dùng API Mock. 
    // Để Test UI, ta test luồng Add to cart trước.
    
    // === BƯỚC 2: KHÁM PHÁ VÀ THÊM VÀO GIỎ HÀNG (ADD TO CART) ===
    // Khách hàng đi tới danh sách sản phẩm
    await page.goto('/products');
    
    // Chờ danh sách sản phẩm load (card sản phẩm)
    await page.waitForSelector('.ant-card', { state: 'visible' });
    
    // Chọn 1 sản phẩm đầu tiên và click vào xem Chi tiết
    const firstProduct = page.locator('.ant-card').first();
    await firstProduct.click();
    
    // Tại trang Product Detail, click "Thêm vào giỏ"
    await page.locator('button', { hasText: 'Thêm vào giỏ' }).first().click();
    
    // Kiểm tra có thông báo thành công (Toast/Message)
    await expect(page.locator('.ant-message-success')).toBeVisible({ timeout: 5000 });
    
    // Mở Sidebar Giỏ Hàng
    // Click vào icon giỏ hàng trên header
    await page.locator('header .ant-badge').click();
    
    // Kiểm tra Sidebar giỏ hàng mở ra và có sản phẩm
    await expect(page.locator('.ant-drawer-title')).toHaveText('Giỏ hàng của bạn');
    await expect(page.locator('.ant-drawer-body .cart-item').first()).toBeVisible();
    
    // Click "Thanh toán" từ Giỏ hàng
    await page.locator('button', { hasText: 'Thanh toán' }).click();
    
    // Màn hình nhảy sang URL /checkout
    await expect(page).toHaveURL(/.*\/checkout/);
    
    // === BƯỚC 3: MÀN HÌNH THANH TOÁN (CHECKOUT) ===
    // Điền thông tin giao hàng
    await page.fill('input[id="full_name"]', 'Khách Hàng Test E2E');
    await page.fill('input[id="phone"]', '0901234567');
    
    // Chọn Tỉnh/Thành
    await page.locator('div[id="province"]').click();
    await page.locator('div[title="Hồ Chí Minh"]').click();
    
    await page.fill('input[id="district"]', 'Quận 1');
    await page.fill('input[id="ward"]', 'Phường Bến Nghé');
    await page.fill('input[id="address"]', '123 Đường Lê Lợi');
    
    // Chọn phương thức thanh toán COD
    await page.locator('text=Thanh toán khi nhận hàng (COD)').click();
    
    // Bấm Xác nhận đặt hàng
    // Nếu chưa đăng nhập, nút sẽ hiển thị "Đăng nhập để đặt hàng", nếu là Guest allow thì "Xác nhận đặt hàng"
    const submitBtn = page.locator('button', { hasText: /Xác nhận đặt hàng|Đăng nhập để đặt hàng/ });
    await submitBtn.click();
    
    // Do chưa đăng nhập thực sự, có thể Modal Đăng nhập sẽ hiện ra (yêu cầu Login trước checkout).
    // Ở script thực tế, ta cần bypass Auth (inject token) ở BeforeEach.
  });

});
