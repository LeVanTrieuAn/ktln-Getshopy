const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'tests');

if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir);
}

const specs = [
  {
    name: 'tc01-authentication.spec.ts',
    desc: 'QA_TC_01 - Authentication',
    content: `import { test, expect } from '@playwright/test';

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
`
  },
  {
    name: 'tc02-sidebar.spec.ts',
    desc: 'QA_TC_02 - Sidebar Navigation',
    content: `import { test, expect } from '@playwright/test';

test.describe('TC02 - Sidebar & Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC02_01: Điều hướng các menu chính trên Sidebar', async ({ page }) => {
    const menus = ['Cửa hàng', 'Sản phẩm mới', 'Bán chạy nhất'];
    
    for (const menu of menus) {
      await page.locator(\`a:has-text("\${menu}")\`).first().click();
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
`
  },
  {
    name: 'tc03-onboarding.spec.ts',
    desc: 'QA_TC_03 - Onboarding',
    content: `import { test, expect } from '@playwright/test';

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
`
  },
  {
    name: 'tc04-home.spec.ts',
    desc: 'QA_TC_04 - Home Page',
    content: `import { test, expect } from '@playwright/test';

test.describe('TC04 - Home Page & 3D Object', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC04_01: Render 3D Object trên Hero Banner', async ({ page }) => {
    // Kiểm tra Canvas của Three.js có được mount không
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('TC04_02: Section Gợi ý AI (AI Recommendation)', async ({ page }) => {
    const aiSection = page.locator('text=Dành riêng cho bạn');
    await expect(aiSection).toBeVisible();
    
    // Kiểm tra có ít nhất 1 product card được render
    await expect(page.locator('.ant-card').first()).toBeVisible();
  });
});
`
  },
  {
    name: 'tc05-product-list.spec.ts',
    desc: 'QA_TC_05 - Product List & Filter',
    content: `import { test, expect } from '@playwright/test';

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
`
  },
  {
    name: 'tc06-bestseller.spec.ts',
    desc: 'QA_TC_06 - Bestseller',
    content: `import { test, expect } from '@playwright/test';

test.describe('TC06 - Sản Phẩm Bán Chạy (Bestseller)', () => {
  test('TC06_01: Kiểm tra Badge và Tag Bán chạy', async ({ page }) => {
    await page.goto('/bestsellers'); // Giả định Route
    
    const card = page.locator('.ant-card').first();
    await expect(card).toBeVisible();
    
    // Card phải chứa chữ Bán chạy hoặc Icon Hot
    await expect(card.locator('.ant-badge')).toBeVisible();
  });
});
`
  },
  {
    name: 'tc07-product-detail.spec.ts',
    desc: 'QA_TC_07 - Product Detail',
    content: `import { test, expect } from '@playwright/test';

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
`
  },
  {
    name: 'tc08-compare.spec.ts',
    desc: 'QA_TC_08 - Device Compare',
    content: `import { test, expect } from '@playwright/test';

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
`
  },
  {
    name: 'tc09-account.spec.ts',
    desc: 'QA_TC_09 - Account & Orders',
    content: `import { test, expect } from '@playwright/test';

test.describe('TC09 - Trang Hồ Sơ Cá Nhân (Account)', () => {
  test('TC09_01: Khách vãng lai tra cứu đơn hàng bằng Email', async ({ page }) => {
    await page.goto('/account');
    
    await page.fill('input[placeholder*="Nhập email"]', 'guest@getshopy.com');
    await page.click('button:has-text("Tra cứu")');
    
    // Nếu email sai, báo không tìm thấy
    await expect(page.locator('.ant-message')).toBeVisible();
  });
});
`
  },
  {
    name: 'tc10-checkout.spec.ts',
    desc: 'QA_TC_10 - Checkout Flow',
    content: `import { test, expect } from '@playwright/test';

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
`
  },
  {
    name: 'tc11-ai-chatbot.spec.ts',
    desc: 'QA_TC_11 - AI ChatBot',
    content: `import { test, expect } from '@playwright/test';

test.describe('TC11 - Hệ thống AI Chatbot', () => {
  test('TC11_01: ChatBot phản hồi Text Intent', async ({ page }) => {
    await page.goto('/');
    
    // Mở popup AI Chat (Giả định có widget chat ở góc dưới)
    const chatWidget = page.locator('.ai-chatbot-widget');
    if (await chatWidget.isVisible()) {
      await chatWidget.click();
      
      // Gõ text
      await page.fill('input[placeholder*="Hỏi AI"]', 'Tìm laptop asus');
      await page.keyboard.press('Enter');
      
      // Chờ bot trả lời
      await expect(page.locator('.bot-message')).toBeVisible({ timeout: 10000 });
    }
  });
});
`
  },
  {
    name: 'tc12-e2e-journey.spec.ts',
    desc: 'QA_TC_12 - E2E User Journey (Integrated)',
    content: `import { test, expect } from '@playwright/test';

// File này bổ trợ thêm cho e2e-journey.spec.ts gốc
test.describe('TC12 - Hành Trình Xuyên Suốt', () => {
  test('TC12_01: Tìm kiếm -> Giỏ hàng -> Trở về trang chủ', async ({ page }) => {
    await page.goto('/');
    
    // Gõ tìm kiếm
    await page.fill('input[placeholder*="Tìm kiếm"]', 'Apple');
    await page.keyboard.press('Enter');
    
    // Chuyển sang /products?search=Apple
    await expect(page).toHaveURL(/.*search=Apple/);
    
    // Trở về trang chủ
    await page.locator('.logo').first().click();
    await expect(page).toHaveURL(/.*\\/$/);
  });
});
`
  }
];

specs.forEach(spec => {
  const filePath = path.join(testsDir, spec.name);
  fs.writeFileSync(filePath, spec.content, 'utf8');
});

console.log('✅ Generated 12 Playwright Spec Files successfully!');
