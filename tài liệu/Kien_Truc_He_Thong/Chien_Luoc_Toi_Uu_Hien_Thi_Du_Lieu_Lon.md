ãyhahaHãy ba

# TECHNICAL IMPLEMENTATION BLUEPRINT: BIG DATA RENDERING & OPTIMIZATION

*(Internal Instruction Manual for Agent / Developer)*

---

## 0. AGENT DIRECTIVES (STRICT RULES FOR IMPLEMENTATION)

When modifying the source code to implement Big Data optimizations for the iStore Analytics project, the following directives MUST be strictly followed:

1. **NO FULL TABLE SCANS**: Never use Prisma's `contains` or SQL `LIKE '%...%'` on `analytics.sale_orders` or large B2C tables without a dedicated index.
2. **NO OFFSET PAGINATION**: All paginated APIs dealing with ClickHouse MUST be refactored to use Cursor-based pagination. Do not accept `page` and `limit` as the only parameters.
3. **NO REDIS FLUSHALL**: The command `redis.flushAll()` is strictly forbidden in production endpoints like `/api/b2c/checkout`. Use targeted invalidation `redis.del(pattern)`.
4. **EVENTUAL CONSISTENCY ACKNOWLEDGMENT**: UI components must assume a 1-5 second delay for data to sync from PostgreSQL -> Kafka -> ClickHouse. Implement Optimistic UI for writes.
5. **PREVENT LAYOUT SHIFTS**: All virtualized lists MUST enforce strict `aspect-ratio` on media elements to ensure `measureElement` in `@tanstack/react-virtual` calculates correctly.

---

## 1. BACKEND ARCHITECTURE & REFACTORING PLAN

### 1.1. Cursor-Based Pagination Implementation (Node.js + ClickHouse)

To solve the deep pagination problem in ClickHouse, we must transition from offset/limit to keyset pagination (cursor).

**The Cursor Encoding Logic:**
A cursor should not be a raw ID if sorting by multiple fields. It must be a Base64 encoded JSON string representing the exact sort boundaries to prevent tie-breaker issues.

*Target Implementation Pattern (Reference for Agent):*

```javascript
// Utility to encode/decode cursor
const encodeCursor = (payload) => Buffer.from(JSON.stringify(payload)).toString('base64');
const decodeCursor = (cursor) => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
  } catch (e) {
    return null;
  }
};

// Inside API Route (e.g., /api/analytics/orders)
app.get('/api/analytics/orders', async (req, res) => {
  const { cursor, limit = 20 } = req.query;
  const decoded = cursor ? decodeCursor(cursor) : null;
  
  let whereClause = "WHERE 1=1";
  // Tie-breaker logic for Sort Stability
  // We sort by order_date DESC, then order_id DESC
  if (decoded && decoded.order_date && decoded.order_id) {
    whereClause += ` AND (order_date < '${decoded.order_date}' OR (order_date = '${decoded.order_date}' AND order_id < '${decoded.order_id}'))`;
  }

  const query = `
    SELECT * FROM analytics.sale_orders
    ${whereClause}
    ORDER BY order_date DESC, order_id DESC
    LIMIT ${parseInt(limit) + 1} -- Fetch one extra to determine if hasNextPage
  `;

  // Fetch using Circuit Breaker (already implemented, but ensure it's used)
  const rows = await chBreaker.fire(query);
  
  let nextCursor = null;
  let hasNextPage = false;
  
  if (rows.length > limit) {
    hasNextPage = true;
    rows.pop(); // Remove the extra record
    const lastRecord = rows[rows.length - 1];
    nextCursor = encodeCursor({
      order_date: lastRecord.order_date,
      order_id: lastRecord.order_id
    });
  }

  res.json({
    data: rows,
    nextCursor,
    hasNextPage
  });
});
```

### 1.2. Redis Cache Invalidation Refactoring

Currently, `index.js` uses `redis.flushAll()` inside the `/api/b2c/checkout` route. This must be refactored to delete specific keys using `SCAN` and `DEL` to protect other cached data.

*Target Implementation Pattern (Reference for Agent):*

```javascript
// Create a utility to invalidate cache patterns
async function invalidateCachePattern(pattern) {
  let cursor = 0;
  do {
    const reply = await redis.scan(cursor, { MATCH: pattern, COUNT: 100 });
    cursor = reply.cursor;
    const keys = reply.keys;
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } while (cursor !== 0);
}

// In /api/b2c/checkout, REPLACE redis.flushAll() with:
// await invalidateCachePattern('kpi:*');
// await invalidateCachePattern('revHour:*');
// await invalidateCachePattern('revBranch:*');
// await invalidateCachePattern('revCat:*');
```

### 1.3. Circuit Breaker Fallback Normalization

The current fallback throws an error: `throw new Error('Hệ thống dữ liệu đang quá tải...');`.
When the agent refactors this, it must ensure the API returns a structured HTTP 503 response so the Frontend can trigger the "Graceful Degradation" UI instead of crashing.

```javascript
// Modify Circuit Breaker fallback in index.js
chBreaker.fallback((queryStr, err) => {
  console.error('🔥 Circuit Breaker Fallback triggered');
  // Return a specific object that the router can catch and format as 503
  return Promise.reject({ status: 503, message: 'Dữ liệu quá tải, vui lòng sử dụng cache', isCircuitOpen: true });
});
```

---

## 2. FRONTEND ARCHITECTURE & REFACTORING PLAN (REACT)

### 2.1. State Management: React Query (Bi-directional Infinite Query)

To handle the RAM bloat when scrolling through millions of records, `@tanstack/react-query` MUST be configured with `useInfiniteQuery` and memory management boundaries.

*Target Implementation Pattern (Reference for Agent):*

```javascript
import { useInfiniteQuery } from '@tanstack/react-query';

const fetchOrders = async ({ pageParam = null }) => {
  const url = pageParam 
    ? `/api/analytics/orders?cursor=${pageParam}&limit=20` 
    : `/api/analytics/orders?limit=20`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 503) {
    throw new Error('503_CIRCUIT_OPEN');
  }
  if (!res.ok) throw new Error('Network response was not ok');
  return res.json();
};

export const useOrdersInfinite = () => {
  return useInfiniteQuery({
    queryKey: ['analytics_orders'],
    queryFn: fetchOrders,
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.nextCursor : undefined,
    // CRITICAL MEMORY MANAGEMENT: 
    // MaxPages ensures RAM doesn't blow up. If maxPages = 5, scrolling to page 6 deletes page 1.
    maxPages: 5, 
    staleTime: 30000, // 30 seconds to prevent aggressive re-fetching
  });
};
```

### 2.2. DOM Virtualization: `@tanstack/react-virtual`

The core of the queue-like rendering. The Agent must integrate this exactly as follows to prevent layout shifts.

*Target Implementation Pattern (Reference for Agent):*

```javascript
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useEffect } from 'react';

export const VirtualizedOrderList = ({ data, fetchNextPage, hasNextPage, isFetchingNextPage }) => {
  const parentRef = useRef(null);

  // Flatten pages from React Query
  const allRows = data ? data.pages.flatMap(d => d.data) : [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allRows.length + 1 : allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimate height, adjust based on actual UI
    overscan: 5, // Buffer items to render outside viewport
  });

  // Intersection logic to fetch more
  const virtualItems = rowVirtualizer.getVirtualItems();
  
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= allRows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, allRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={parentRef} style={{ height: '800px', overflow: 'auto', position: 'relative' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualItems.map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allRows.length - 1;
          const order = allRows[virtualRow.index];

          return (
            <div
              key={virtualRow.index}
              ref={rowVirtualizer.measureElement} // CRITICAL for dynamic heights
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <SkeletonRow /> // 3.3 Implementation
              ) : (
                <OrderCard order={order} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

### 2.3. Scroll Restoration (The "Back Button" UX Problem)

When navigating away from a virtualized list to a detail page, the component unmounts. When navigating back, the `scrollTop` is lost, forcing the user back to the top. The Agent MUST implement scroll restoration.

*Directives for Scroll Restoration:*

1. Use `sessionStorage` or Zustand to store `parentRef.current.scrollTop` during the `componentWillUnmount` phase or via a navigation interceptor.
2. Provide `initialOffset` to the `useVirtualizer` configuration:

```javascript
  const savedScroll = parseInt(sessionStorage.getItem('orderListScroll') || '0', 10);
  const rowVirtualizer = useVirtualizer({
    // ...
    initialOffset: savedScroll,
  });
```

### 2.4. Handling HTAP Eventual Consistency (Optimistic UI)

Because the `analytics.sale_orders` table in ClickHouse receives data from Kafka CDC, it has a 1-5 second delay.
If a B2B admin manually forces a sync or creates an entry, the UI shouldn't wait 5 seconds to show it.

*Directives for Optimistic Update:*

1. When calling `POST /api/admin/simulate-sale`.
2. Intercept the React Query cache and inject a fake record:

```javascript
const queryClient = useQueryClient();
queryClient.setQueryData(['analytics_orders'], (oldData) => {
  if (!oldData) return oldData;
  const newRecord = {
    order_id: 'PENDING_SYNC_' + Date.now(),
    // ... optimistic fields ...
    status: 'SYNCING_TO_CLICKHOUSE',
    isOptimistic: true // UI will render this with low opacity
  };
  
  // Prepend to the first page
  const newPages = [...oldData.pages];
  newPages[0] = { ...newPages[0], data: [newRecord, ...newPages[0].data] };
  return { ...oldData, pages: newPages };
});
```

---

## 3. EDGE CASES & POTENTIAL BLIND SPOTS (AGENT CHECKLIST)

### 3.1. Floating Point Precision Ruins Analytics

When calculating aggregates in JavaScript for the Frontend (if any client-side aggregations are needed), the Agent must NEVER use standard operators (e.g., `a * b`).
*Directive:* Always use `Math.round()` after arithmetic if dealing with VND, or keep calculations purely server-side (ClickHouse `Decimal(18,2)` handles it correctly, but Node.js `parseFloat` can lose precision).

### 3.2. Idempotency Key Injection

To prevent "Exactly-Once" issues caused by network retries when checking out, the Frontend MUST generate an Idempotency Key (e.g., `UUID v4`) when the Checkout component mounts, and pass it in the Headers: `X-Idempotency-Key`.
While the backend's ClickHouse `ReplacingMergeTree` handles DB deduplication, the Node.js API should ideally cache this key in Redis for 24h to block duplicate HTTP requests instantly.

### 3.3. Circuit Breaker UI (Graceful Degradation)

If the query throws `503_CIRCUIT_OPEN`, the Frontend MUST catch it inside the `onError` or ErrorBoundary.
*Directive:* Do NOT show a blank screen. Render the cached data (if available) and show a warning `Alert` component (Ant Design) fixed at the top:
`<Alert type="warning" message="Dữ liệu hệ thống đang được tải chậm do lưu lượng lớn. Bạn đang xem bản lưu tạm." banner />`

### 3.4. Tombstone Events (Deletions) in ClickHouse

In the schema docs, `analytics.sale_orders` has an `_cdc_op` field (`c`, `u`, `d`).
If a record is deleted, it emits a `d`.
*Directive:* When the Agent writes ClickHouse queries, it must ALWAYS append `WHERE _cdc_op != 'd'` or handle the `sign` logic if `CollapsingMergeTree` is implemented. Since the schema mentions `ReplacingMergeTree(created_at)`, we rely on `_cdc_op` to filter out deleted rows.
Example:

```sql
SELECT * FROM analytics.sale_orders 
WHERE _cdc_op != 'd' 
AND order_date < {cursor} 
ORDER BY order_date DESC LIMIT 20;
```

---

## 4. EXECUTION PROTOCOL (HOW TO USE THIS FILE)

When the USER commands the Agent to "Implement the Big Data optimizations", the Agent will:

1. Open and parse this file (`Chien_Luoc_Toi_Uu_Hien_Thi_Du_Lieu_Lon.md`).
2. Identify which subsystem (Backend Node.js, Frontend React Query, or Frontend Virtualization) is the target.
3. Apply the *exact* code patterns and directives outlined above.
4. Verify the changes against the checklists in Section 3.
5. Create a Walkthrough artifact to show the user the implementation matches the blueprint.

**DO NOT DEVIATE FROM THIS BLUEPRINT WITHOUT EXPLICIT USER PERMISSION.**
