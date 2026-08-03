

---

# TÀI LIỆU GỐC: implementation_plan.md

# Ant Design, i18n, & Theme Refactoring Plan

The application currently has a hardcoded HTML/CSS UI and static sidebar tabs. This plan details the migration to a fully functional Ant Design architecture with multi-language support (i18n) and a Light/Dark mode toggle.

## User Review Required

> [!IMPORTANT]
> - **Translations**: I will configure English (EN) and Vietnamese (VI) as the two supported languages. If you want additional languages, please let me know.
> - **Tab Navigation**: I will refactor the sidebar to actually switch the main content view between *Storefront*, *Inventory*, *Customers*, and *Settings*. Currently, only *Storefront* has data; the others will show placeholder text until we build them.

## Proposed Changes

### 1. Install Dependencies
Run `npm install i18next react-i18next` in the `client` directory to support multi-language features.

### 2. Configure i18n
#### [NEW] [client/src/i18n.js](file:///d:/kh%C3%B3a-lu%E1%BA%ADn-t%E1%BB%91t-nghi%E1%BB%87p/qu-n-ly-ban-l/source/client/src/i18n.js)
- Create a configuration file containing translation dictionaries for English and Vietnamese.

### 3. App Provider Configuration
#### [MODIFY] [client/src/App.jsx](file:///d:/kh%C3%B3a-lu%E1%BA%ADn-t%E1%BB%91t-nghi%E1%BB%87p/qu-n-ly-ban-l/source/client/src/App.jsx)
- Wrap the application in Ant Design's `ConfigProvider`.
- Manage the global state for `theme` (light/dark) and pass it to the provider to dynamically switch colors.

### 4. Dashboard Refactoring
#### [MODIFY] [client/src/pages/Dashboard.jsx](file:///d:/kh%C3%B3a-lu%E1%BA%ADn-t%E1%BB%91t-nghi%E1%BB%87p/qu-n-ly-ban-l/source/client/src/pages/Dashboard.jsx)
- Rebuild the layout using Ant Design's `<Layout>`, `<Sider>`, and `<Header>` components.
- Use Ant Design's `<Menu>` to handle sidebar clicks and switch a React state (`activeTab`) to render different views.
- Add a Theme Toggle switch and Language selector dropdown in the header.
- Rebuild the Storefront product grid using Ant Design `<Card>`, `<Row>`, and `<Col>` components.

## Verification Plan
1. Start the client and server.
2. Verify that clicking sidebar items switches the view.
3. Click the Dark/Light mode toggle and ensure Ant Design components adapt correctly.
4. Switch between EN/VI languages and verify that sidebar text and product labels translate dynamically.


---

# TÀI LIỆU GỐC: prd_financial_dashboard.md

# GAP ANALYSIS — Tài Liệu Hiện Có vs Tài Liệu Cần Để Code

## ĐÁNH GIÁ TÀI LIỆU HIỆN TẠI

| File | Nội dung | Dùng để làm gì | Đủ để code chưa? |
|:---|:---|:---|:---:|
| `system_specification.md` | Kiến trúc tổng thể, use-cases | Pitch cho GVHD, định hướng | ❌ Thiếu chi tiết |
| `academic_paper_outline.md` | Cấu trúc bài báo khoa học | Viết khóa luận | ❌ Không dùng để code |
| `senior_architect_problems_and_feasibility.md` | Danh sách apps, demo script | Thuyết phục hội đồng | ⚠️ Có timeline nhưng thiếu spec |
| `streaming_problems_deep_dive.md` | 24 vấn đề streaming | Chương lý thuyết khóa luận | ❌ Lý thuyết thuần túy |
| `high_availability_brainstorm.md` | HA, Quorum, Circuit Breaker | Chương architecture | ❌ Lý thuyết thuần túy |
| `financial_audit_trail_brainstorm.md` | Kế toán, reconciliation | Chương tính năng | ⚠️ Có queries nhưng thiếu schema |
| `enterprise_scale_brainstorm.md` | Event Sourcing, Time-Travel | Chương lý thuyết | ❌ Lý thuyết thuần túy |
| `extended_brainstorm.md` | 11 genius features | Ý tưởng tính năng | ❌ Chưa có spec |
| `implementation_plan.md` | Ant Design, i18n, Dark Mode | Plan UI cũ | ⚠️ Chỉ cho UI cũ |

## CÁC TÀI LIỆU ĐANG THIẾU (Cần thiết để code)

> [!CAUTION]
> Không có những tài liệu dưới đây → Lập trình viên sẽ phải tự quyết định mọi thứ → Code xong không match với kỳ vọng.

| Tài liệu thiếu | Mức độ cần thiết | Ảnh hưởng nếu thiếu |
|:---|:---:|:---|
| **Database Schema (ERD)** | 🔴 CRITICAL | Không biết cấu trúc data, không thể query |
| **API Specification (REST/GraphQL)** | 🔴 CRITICAL | Frontend không biết gọi endpoint nào |
| **UI Wireframes từng màn hình** | 🔴 CRITICAL | Không biết layout cụ thể, thiếu gì thừa gì |
| **User Flow / Use Case chi tiết** | 🟠 HIGH | Không biết người dùng tương tác như thế nào |
| **ClickHouse Schema & Sample Queries** | 🔴 CRITICAL | Không thể build analytics features |
| **Authentication/Authorization Spec** | 🟠 HIGH | Ai được xem gì? RBAC thế nào? |
| **Kafka Topic & Message Schema** | 🔴 CRITICAL | Consumer không biết data format |
| **Environment & Config Spec** | 🟡 MEDIUM | Deploy không được, biến môi trường thế nào |
| **Error Handling Spec** | 🟡 MEDIUM | UI không biết hiển thị lỗi như thế nào |
| **Component Architecture** | 🟡 MEDIUM | Code không có cấu trúc nhất quán |

---
---

# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## App: Financial Analytics Dashboard — Apple Authorized Reseller
### Version 1.0 | Sẵn sàng để code ngay

> **Phạm vi:** App này consume data từ CDC Kafka pipeline đang có (`erp.pm_saleorder`, `erp.pm_inputvoucher`, `erp.pm_outputvoucher`) và hiển thị real-time financial analytics cho CFO/Accountant/Store Manager.

---

## 1. TECH STACK

```
Frontend:   React 19 + Ant Design 5 + Apache ECharts + i18n (vi/en) + Dark Mode
Backend:    Node.js 20 + Express
Database:   ClickHouse (Analytics) + PostgreSQL (Auth/Config)
Streaming:  Kafka (đã có) → ClickHouse Consumer (cần build)
Deploy:     Docker Compose
Port:       Frontend :5173 | Backend :8080 | ClickHouse :8123
```

---

## 2. USER ROLES & PERMISSIONS

| Role | Có thể xem | Không thể xem |
|:---|:---|:---|
| **CEO / GM** | Tất cả (toàn chuỗi) | - |
| **CFO / Accountant** | Tài chính tất cả chi nhánh | Không xem HR |
| **Store Manager** | Doanh thu chi nhánh của mình | Chi nhánh khác |
| **Sales Staff** | Dashboard cá nhân | Tài chính |

---

## 3. DATABASE SCHEMA

### 3.1. PostgreSQL (Auth & Config)
```sql
-- Users
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          VARCHAR(50) NOT NULL,  -- 'CEO','CFO','MANAGER','STAFF'
  branch_id     VARCHAR(50),           -- NULL = toàn chuỗi
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Branches
CREATE TABLE branches (
  id        VARCHAR(50) PRIMARY KEY,  -- 'HN001', 'HCM001'
  name      VARCHAR(255) NOT NULL,
  region    VARCHAR(50) NOT NULL,     -- 'NORTH','SOUTH','CENTRAL'
  address   TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Alert Rules
CREATE TABLE alert_rules (
  id          SERIAL PRIMARY KEY,
  rule_name   VARCHAR(255) NOT NULL,
  condition   JSONB NOT NULL,  -- {"metric":"void_rate","operator":">","threshold":0.15}
  severity    VARCHAR(20),     -- 'LOW','MEDIUM','HIGH','CRITICAL'
  is_active   BOOLEAN DEFAULT TRUE
);
```

### 3.2. ClickHouse (Analytics — nhận từ Kafka CDC)
```sql
-- Bảng chính: Sale Orders (từ erp.pm_saleorder)
CREATE TABLE sale_orders (
  order_id       String,
  branch_id      String,
  branch_name    String,
  region         String,
  salesperson_id String,
  customer_id    String,
  total_amount   Decimal(18, 2),
  discount       Decimal(18, 2) DEFAULT 0,
  net_amount     Decimal(18, 2),  -- total - discount
  status         String,          -- 'CONFIRMED','VOIDED','PENDING'
  payment_method String,          -- 'CASH','CARD','TRANSFER','MOMO','VNPAY'
  order_date     DateTime,
  created_at     DateTime DEFAULT now(),
  -- Kafka metadata (để debug)
  _kafka_offset  Int64,
  _kafka_topic   String,
  _cdc_op        String           -- 'c'=create, 'u'=update, 'd'=delete
) ENGINE = ReplacingMergeTree(created_at)
  PARTITION BY toYYYYMM(order_date)
  ORDER BY (order_id, branch_id, order_date);

-- Input Vouchers / Phiếu thu (từ erp.pm_inputvoucher)
CREATE TABLE input_vouchers (
  voucher_id    String,
  order_id      String,          -- FK đến sale_orders
  branch_id     String,
  amount        Decimal(18, 2),
  voucher_date  DateTime,
  payment_type  String,
  note          String,
  created_at    DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
  PARTITION BY toYYYYMM(voucher_date)
  ORDER BY (voucher_id, order_id);

-- Output Vouchers / Phiếu chi (từ erp.pm_outputvoucher)
CREATE TABLE output_vouchers (
  voucher_id    String,
  order_id      String,
  branch_id     String,
  amount        Decimal(18, 2),
  voucher_date  DateTime,
  category      String,          -- 'REFUND','COGS','EXPENSE'
  note          String,
  created_at    DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
  PARTITION BY toYYYYMM(voucher_date)
  ORDER BY (voucher_id);

-- Materialized View: Reconciliation Status (tự động tính khi có data mới)
CREATE MATERIALIZED VIEW reconciliation_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(order_date)
ORDER BY (order_id, branch_id) AS
SELECT
  s.order_id,
  s.branch_id,
  s.net_amount       as sale_amount,
  SUM(iv.amount)     as received_amount,
  s.net_amount - SUM(iv.amount) as gap,
  CASE
    WHEN ABS(s.net_amount - SUM(iv.amount)) < 1000 THEN 'MATCHED'
    WHEN SUM(iv.amount) = 0 THEN 'PENDING'
    ELSE 'MISMATCH'
  END as recon_status,
  s.order_date
FROM sale_orders s
LEFT JOIN input_vouchers iv ON s.order_id = iv.order_id
GROUP BY s.order_id, s.branch_id, s.net_amount, s.order_date;
```

---

## 4. API ENDPOINTS

### 4.1. Auth
```
POST   /api/auth/login          Body: {email, password}  → {token, user}
POST   /api/auth/logout         Headers: Authorization
GET    /api/auth/me             Headers: Authorization    → {user}
```

### 4.2. Dashboard KPIs (Real-time)
```
GET    /api/dashboard/kpis
  Query: ?branch_id=HN001&date_from=2024-03-01&date_to=2024-03-31
  Response:
  {
    "revenue_today": 1250000000,
    "revenue_vs_yesterday_pct": 12.5,
    "orders_today": 45,
    "avg_order_value": 27777778,
    "cash_collected": 980000000,
    "net_cash": 530000000,
    "pending_recon": 45,
    "void_rate": 2.3
  }
```

### 4.3. Revenue Analytics
```
GET    /api/analytics/revenue/by-hour
  Query: ?date=2024-03-15&branch_id=ALL
  Response: [{hour: "09:00", revenue: 125000000, orders: 5}, ...]

GET    /api/analytics/revenue/by-branch
  Query: ?date_from=...&date_to=...
  Response: [{branch_id, branch_name, revenue, orders, rank}, ...]

GET    /api/analytics/revenue/by-category
  Query: ?date_from=...&date_to=...
  Response: [{category: "iPhone", revenue, pct_of_total}, ...]
```

### 4.4. Reconciliation
```
GET    /api/reconciliation/status
  Query: ?branch_id=&date_from=&date_to=&status=MISMATCH
  Response:
  {
    "summary": {"MATCHED": 312, "PENDING": 45, "MISMATCH": 12},
    "items": [{order_id, sale_amount, received_amount, gap, status}, ...]
  }
```

### 4.5. Alerts
```
GET    /api/alerts/active
  Response: [{id, rule_name, branch_id, severity, message, triggered_at}, ...]

PUT    /api/alerts/:id/acknowledge
  Body: {note: "Đã kiểm tra"}
```

### 4.6. Supply Chain
```
GET    /api/supply-chain/fulfillment
  Query: ?branch_id=&status=BREACHED
  Response: [{order_id, order_time, ship_time, hours_elapsed, sla_status}, ...]

GET    /api/supply-chain/sla-summary
  Response: {on_time_rate: 96.8, breach_count: 12, avg_fulfillment_hours: 18.5}
```

---

## 5. UI SCREENS — CHI TIẾT TỪNG MÀN HÌNH

### Screen 1: LOGIN (/)
```
┌─────────────────────────────────────┐
│            🍎 iStore POS            │
│         Authorized Reseller         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Email                        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Password                    │   │
│  └─────────────────────────────┘   │
│                                     │
│  [    Sign In with Apple ID    ]    │
│                                     │
│  🌐 VI | EN    🌙 Dark Mode         │
└─────────────────────────────────────┘
```

### Screen 2: DASHBOARD (/dashboard)
```
┌──────────────────────────────────────────────────────────────┐
│ SIDEBAR          │         MAIN CONTENT                      │
│                  │                                           │
│ 🍎 iStore POS   │  [Branch Selector ▼] [Date Range 📅]     │
│ Authorized       │                                           │
│                  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ 📊 Dashboard  ← │  │ Revenue  │ │ Orders   │ │ Net Cash │  │
│ 📦 Storefront    │  │ 1.25 tỷ  │ │   45 đơn │ │ 530 tr   │  │
│ 💰 Financial     │  │ ↑12.5%  │ │ ↑5%     │ │ ↑3.2%   │  │
│ 🔍 Recon         │  └──────────┘ └──────────┘ └──────────┘  │
│ ⚠️  Alerts   🔴3│                                           │
│ 🚚 Fulfillment   │  [Revenue by Hour — Line Chart Live]      │
│ ⚙️  Settings     │  █▄▃▅▆▇█▇▆▄▃▅▆█ (updates every 5s)     │
│                  │                                           │
│ ─────────────── │  [Top 5 Branches Today — Bar Chart]       │
│ 👤 Admin User   │  HN001 ████████████ 450tr                 │
│ CEO              │  HCM001 ██████████  380tr                 │
│ [Logout →]       │  HCM002 ████████    290tr                 │
└──────────────────────────────────────────────────────────────┘
```

### Screen 3: FINANCIAL (/financial)
```
Tabs: [Overview] [P&L] [Cash Flow] [Reconciliation]

Tab "Reconciliation":
┌──────────────────────────────────────────────────┐
│ Reconciliation Status                            │
│                                                  │
│ [✅ Matched: 312] [⚠️ Pending: 45] [🔴 Mismatch: 12] │
│                                                  │
│ Filter: [Branch ▼] [Status ▼] [Date ▼] [Search] │
│                                                  │
│ Order ID    │ Sale Amount │ Received │ Gap  │ Status │
│ PM24-001   │ 33,990,000  │ 33,990,000│  0  │ ✅     │
│ PM24-002   │ 25,990,000  │ 0         │ -25M │ ⚠️Pend │
│ PM24-003   │ 49,990,000  │ 45,000,000│ -5M  │ 🔴Mis  │
│                                                  │
│ [Export CSV] [Export PDF]          [Pagination]  │
└──────────────────────────────────────────────────┘
```

### Screen 4: ALERTS (/alerts)
```
┌──────────────────────────────────────────────────┐
│ 🚨 Active Alerts (3)                             │
│                                                  │
│ [CRITICAL] Branch HN001 - Void rate 35%          │
│ Triggered: 10:30:05 | Employee: EMP001           │
│ [Acknowledge] [Investigate →]                    │
│                                                  │
│ [HIGH] Branch HCM002 - Revenue anomaly -3σ       │
│ Today: 45tr (Avg: 280tr) | Possible issue        │
│ [Acknowledge] [Investigate →]                    │
│                                                  │
│ [MEDIUM] 12 orders > 30 days unreconciled        │
│ Total gap: 87,000,000 VND                        │
│ [View Orders →]                                  │
└──────────────────────────────────────────────────┘
```

---

## 6. KAFKA CONSUMER — ClickHouse Writer

```javascript
// consumer/clickhouse-writer.js
const { Kafka } = require('kafkajs');
const { createClient } = require('@clickhouse/client');

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKERS] });
const ch = createClient({ url: process.env.CLICKHOUSE_URL });

const consumer = kafka.consumer({ groupId: 'financial-dashboard' });

const TOPIC_TABLE_MAP = {
  'erp.pm_saleorder':     'sale_orders',
  'erp.pm_inputvoucher':  'input_vouchers',
  'erp.pm_outputvoucher': 'output_vouchers',
};

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topics: Object.keys(TOPIC_TABLE_MAP) });

  await consumer.run({
    eachBatch: async ({ batch, commitOffsetsIfNecessary }) => {
      const rows = batch.messages.map(m => {
        const event = JSON.parse(m.value.toString());
        return transformEvent(event, batch.topic);
      }).filter(Boolean);

      if (rows.length > 0) {
        await ch.insert({
          table: TOPIC_TABLE_MAP[batch.topic],
          values: rows,
          format: 'JSONEachRow',
        });
      }

      await commitOffsetsIfNecessary();
    },
  });
}

function transformEvent(event, topic) {
  // Debezium format: { before, after, op, ts_ms }
  if (event.op === 'd') return null; // Soft delete handled separately
  const data = event.after || event;
  return {
    ...data,
    _cdc_op: event.op || 'c',
    _kafka_topic: topic,
    created_at: new Date().toISOString(),
  };
}

run().catch(console.error);
```

---

## 7. FRAUD DETECTION — Kafka Streams Rules

```javascript
// streams/fraud-detector.js
// Chạy như 1 microservice riêng, listen Kafka

const RULES = [
  {
    name: 'HIGH_VOID_RATE',
    window: 60 * 60 * 1000, // 1 giờ
    check: (events) => {
      const voided = events.filter(e => e.status === 'VOIDED').length;
      const rate = voided / events.length;
      return rate > 0.15 ? { severity: 'HIGH', rate } : null;
    }
  },
  {
    name: 'AFTER_HOURS_CASH',
    check: (event) => {
      const hour = new Date(event.order_date).getHours();
      return (hour >= 22 || hour < 7) && event.payment_method === 'CASH'
        ? { severity: 'MEDIUM' } : null;
    }
  },
  {
    name: 'PRICE_DEVIATION',
    check: (event) => {
      // So sánh với product price list (từ config)
      return null; // implement based on your product data
    }
  }
];
```

---

## 8. ENVIRONMENT VARIABLES

```env
# Backend (.env)
PORT=8080
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=8h

# Database
POSTGRES_URL=postgresql://user:pass@localhost:5432/istore
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_DB=analytics

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_GROUP_ID=financial-dashboard
KAFKA_TOPICS=erp.pm_saleorder,erp.pm_inputvoucher,erp.pm_outputvoucher

# Frontend (.env)
VITE_API_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080
```

---

## 9. PROJECT STRUCTURE

```
source/
├── client/                  # React Frontend
│   ├── src/
│   │   ├── i18n/
│   │   │   ├── vi.json      # Tiếng Việt
│   │   │   └── en.json      # English
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Financial.jsx
│   │   │   ├── Alerts.jsx
│   │   │   └── Fulfillment.jsx
│   │   ├── components/
│   │   │   ├── KPICard.jsx         # Reusable metric card
│   │   │   ├── RevenueChart.jsx    # ECharts line chart
│   │   │   ├── BranchRanking.jsx   # Bar chart
│   │   │   ├── ReconTable.jsx      # Ant Design table
│   │   │   ├── AlertList.jsx       # Alert cards
│   │   │   └── Sidebar.jsx         # Navigation
│   │   ├── hooks/
│   │   │   ├── useKPIs.js          # SWR/React Query for KPI data
│   │   │   ├── useAlerts.js        # Real-time alerts
│   │   │   └── useWebSocket.js     # Live updates
│   │   ├── context/
│   │   │   ├── ThemeContext.jsx    # Dark/Light mode
│   │   │   └── AuthContext.jsx     # User session
│   │   └── App.jsx
│
├── server/                  # Node.js Backend
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── dashboard.js
│   │   │   ├── financial.js
│   │   │   ├── alerts.js
│   │   │   └── fulfillment.js
│   │   ├── services/
│   │   │   ├── clickhouse.js   # ClickHouse query service
│   │   │   ├── kafka.js        # Kafka consumer
│   │   │   └── alerts.js       # Alert evaluation engine
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT verification
│   │   │   └── rbac.js         # Role-based access
│   │   └── index.js
│
└── docker-compose.yml       # ClickHouse + Kafka + PostgreSQL
```

---

## 10. IMPLEMENTATION ORDER (Thứ tự code)

```
Ngày 1-2:   Setup ClickHouse, tạo schema, test connection
Ngày 3-4:   Build Kafka Consumer → ClickHouse Writer
Ngày 5-6:   Build API endpoints (KPIs, Revenue by hour)
Ngày 7-8:   Build Dashboard page (KPI Cards + Line Chart)
Ngày 9-10:  Build Reconciliation page + Table
Ngày 11-12: Build Alerts system + Fraud Detection rules
Ngày 13-14: Build Fulfillment Tracker
Ngày 15:    i18n (VI/EN) + Dark Mode + Polish
Ngày 16-17: Integration test + Demo scripts
Ngày 18:    Docker Compose production setup + Documentation
```

> [!TIP]
> Tài liệu này (`prd_financial_dashboard.md`) kết hợp với các tài liệu lý thuyết đang có (`system_specification.md`, `senior_architect_problems_and_feasibility.md`) là đủ để một lập trình viên ngồi xuống và code được ngay. Bước tiếp theo là approve PRD này và bắt đầu từ "Ngày 1".


---

# TÀI LIỆU GỐC: system_specification.md

# Enterprise Apple Authorized Reseller (AAR) System Specification
*Tài liệu Đặc tả Hệ thống Quản trị & Bán lẻ chuẩn Thương mại tích hợp Big Data Pipeline*

Tài liệu này phác thảo kiến trúc và đặc tả tính năng cho một hệ sinh thái phần mềm cấp doanh nghiệp (Enterprise-grade) dành cho đại lý ủy quyền của Apple, đảm bảo khả năng vận hành thực tế, mở rộng chuỗi và đáp ứng các tiêu chuẩn khắt khe nhất của ngành bán lẻ.

Đặc biệt, hệ thống được thiết kế để trở thành nguồn cung cấp dữ liệu (Source System) cho nền tảng **Big Data Data Platform** thông qua luồng **CDC Kafka**, nhằm phô diễn toàn bộ sức mạnh xử lý dữ liệu thời gian thực.

---

## 1. Kiến trúc Hệ sinh thái (System Architecture)
Hệ thống không chỉ là một ứng dụng đơn lẻ mà là một hệ sinh thái Omnichannel (Bán lẻ đa kênh), bao gồm:

1. **POS (Point of Sale) App**: Ứng dụng tại quầy dành cho nhân viên bán hàng (tối ưu cho iPad và Màn hình cảm ứng).
2. **E-Commerce Web App**: Trang mua sắm trực tuyến cho khách hàng cuối (B2C) tích hợp trả góp.
3. **ERP / Backoffice System**: Hệ thống quản trị trung tâm dành cho Ban giám đốc, Kế toán, và Quản lý kho.
4. **CRM & Loyalty App**: Hệ thống quản lý quan hệ khách hàng và hạng thẻ thành viên.

---

## 2. Tích hợp Luồng Dữ liệu Lớn (Big Data CDC Kafka Pipeline)

Để làm nổi bật sức mạnh xử lý dữ liệu (Big Data Features) của nền tảng, ứng dụng E-commerce / POS này sẽ đóng vai trò là "Data Producer" hoàn hảo. Mọi thay đổi dữ liệu (Insert, Update, Delete) dưới Database của hệ thống (PostgreSQL/MySQL) sẽ được bắt tự động qua cơ chế **CDC (Change Data Capture)**, đẩy vào **Apache Kafka**, và stream thẳng sang **ClickHouse** để phân tích thời gian thực.

Dưới đây là 4 Ứng dụng (Applications) phân tích dữ liệu chuyên sâu được xây dựng trên nền tảng này:

### 2.1. Real-time ERP/POS Analytics (Ứng dụng phân tích Bán lẻ thời gian thực)
*Sử dụng luồng dữ liệu đơn hàng (Ví dụ: `erp.pm_saleorder`)*
- **Data Flow**: Khách hàng đặt mua iPhone/MacBook → CDC bắt thay đổi → Kafka → ClickHouse.
- **Tính năng nổi bật**:
  - **Real-time Inventory Tracking**: Dashboard tồn kho nhảy số ngay lập tức khi có máy được xuất kho, độ trễ tính bằng mili-giây.
  - **Revenue Dashboard (Theo giờ)**: Lãnh đạo xem doanh thu nhảy real-time trong ngày mở bán iPhone mới (Launch Day).
  - **Fraud Detection (Chống gian lận)**: Phát hiện ngay lập tức nhân viên tạo đơn hàng bất thường (giá bán sai lệch, chiết khấu quá mức) và gửi Alert.

### 2.2. E-commerce Behavior Analytics (Nền tảng phân tích hành vi mua sắm)
*Sử dụng luồng dữ liệu clickstream và giỏ hàng.*
- **Data Flow**: Hành vi lướt web của user / Thêm vào giỏ hàng → CDC / Event Tracker → Kafka → ClickHouse.
- **Tính năng nổi bật**:
  - **Cart Abandonment Detection**: Tự động phát hiện khách hàng bỏ quên giỏ hàng chứa MacBook Pro trong 30 phút và kích hoạt kịch bản gửi Email Voucher giảm 5%.
  - **Real-time Recommendation**: Hệ thống AI gợi ý mua phụ kiện (Magic Mouse, AirPods) thay đổi tức thời dựa trên sản phẩm khách vừa click vào.
  - **Dynamic Pricing**: Điều chỉnh giá tự động nếu phát hiện lượng truy cập vào một sản phẩm tăng đột biến nhưng lượng mua thấp.

### 2.3. Financial/Accounting Intelligence (Hệ thống Kế toán Tài chính)
*Sử dụng luồng dữ liệu chứng từ thu/chi (Ví dụ: `pm_inputvoucher`, `pm_outputvoucher`)*
- **Data Flow**: Phát sinh chứng từ thu/chi → CDC → Kafka → ClickHouse.
- **Tính năng nổi bật**:
  - **Real-time P&L Tracking**: Báo cáo Lợi nhuận và Lỗ (Profit & Loss) được cập nhật theo thời gian thực thay vì chờ kế toán chốt sổ cuối tháng.
  - **Invoice Reconciliation (Đối soát tự động)**: Tự động so khớp dữ liệu đơn hàng (Sale Order) với chứng từ thu (Input Voucher) xem dòng tiền đã thực sự về tài khoản chưa.
  - **Cash Flow Monitoring**: Giám sát dòng tiền của chuỗi cửa hàng.

### 2.4. Supply Chain & Fulfillment Monitoring (Giám sát Chuỗi cung ứng)
*Sử dụng luồng dữ liệu vận chuyển và đơn đặt hàng*
- **Data Flow**: `pm_saleorder` → `pm_outputvoucher` → `delivery_status` → CDC → Kafka.
- **Tính năng nổi bật**:
  - **Track Fulfillment Steps**: Theo dõi từng bước đơn hàng từ lúc chốt đơn đến khi giao cho đơn vị vận chuyển.
  - **SLA Breach Detection**: Cảnh báo thời gian thực nếu đơn hàng giao trễ hơn cam kết (Ví dụ: Giao hỏa tốc 2H nhưng qua 1H30p kho chưa xuất hàng).
  - **Supplier Performance**: Đánh giá hiệu suất của các nhà cung cấp phụ kiện.

---

## 3. Các Tiêu Chí Kỹ Thuật Chứng Minh Sức Mạnh Big Data (GVHD Demo Guidelines)

Hệ thống POS/E-commerce này sẽ được dùng để demo trực tiếp các đặc tính (Features) của kiến trúc Big Data trước Hội đồng Bảo vệ Khóa luận:

| Feature Đặc trưng | Kịch bản Demo trên hệ thống E-commerce / POS |
| :--- | :--- |
| **High Throughput (Lưu lượng cao)** | Chạy script tự động tạo 1.000.000 đơn hàng (Insert 1M records) vào E-commerce DB. Mở Grafana/ClickHouse dashboard để đo thời gian dữ liệu cập nhật. |
| **Low Latency (Độ trễ thấp)** | Nhân viên POS bấm "Thanh toán" đơn hàng 1 chiếc iPhone. Quay sang màn hình Financial Dashboard của CFO xem doanh thu nhảy ngay lập tức trong vòng vài giây. |
| **Fault Tolerance (Khả năng chịu lỗi)** | Giả lập sự cố: Tắt đột ngột (Kill) Kafka Broker trong khi POS vẫn tiếp tục bán hàng. Sau đó Restart Kafka và chứng minh dữ liệu đơn hàng không hề bị mất mát (No data loss). |
| **Scalability (Mở rộng linh hoạt)** | Tăng đột ngột khối lượng dữ liệu lịch sử bán hàng lên gấp 10 lần. Thực hiện các câu query phức tạp trên ClickHouse (Ví dụ: Tìm top sản phẩm bán chạy nhất trong 5 năm) và đo lường thời gian query (Query time) vẫn duy trì ở mức tối ưu. |
| **Data Quality & Auto-heal** | Cố tình tiêm lỗi (Inject lỗi) vào dữ liệu đơn hàng. Trình diễn cách Checksum Worker phát hiện bất thường và hệ thống tự động cảnh báo/sửa chữa (Auto-heal). |

---

## 4. Tóm tắt Giá trị Đề tài
Với sự kết hợp giữa hệ thống **E-commerce/POS chuẩn Apple Authorized Seller** (Tạo ra dữ liệu thật, nghiệp vụ thật) và nền tảng **Kafka CDC & ClickHouse** (Xử lý dữ liệu lớn), đề tài khóa luận này giải quyết trọn vẹn 2 bài toán:
1. Xây dựng ứng dụng kinh doanh có tính thực tiễn và tính thẩm mỹ cao (Ant Design, i18n, Dark Mode).
2. Trình diễn được năng lực xử lý Big Data cấp doanh nghiệp, có giá trị ứng dụng cao cho Ban Giám đốc (CFO, Store Manager) để ra quyết định dựa trên dữ liệu (Data-driven decision making).
