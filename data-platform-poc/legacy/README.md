# Bản POC trước khi tích hợp

Mã ở đây nhắm vào một schema **không còn tồn tại**: bảng `orders` /
`orders_detail` chữ thường, giá tính bằng USD, `product_id` bịa trong khoảng
101–602, và trỏ tới một Postgres rời ở `10.1.10.91`.

Hệ hiện tại dùng `"Order"` / `"OrderItem"` (PascalCase, do Prisma sinh), tiền là
`Int` đơn vị đồng, và `product_id` phải là khoá thật trong bảng `"Product"` —
nếu không thì dbt `INNER JOIN dim_products` sẽ loại sạch, và AI-Rec không nhận
được gì.

Giữ lại để đối chiếu lịch sử. Bản đang dùng: `../pos_simulator.py`.
