import { useRef, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, Typography, Spin, Alert, Tag, Row, Col } from 'antd';
import { DatabaseOutlined, WarningOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import { useApp } from '../context/AppContext';

const { Title, Text } = Typography;

const fetchOrders = async ({ pageParam = null }) => {
  const res = await api.analytics.getOrders(pageParam, 50); // Fetch 50 at a time for 1M records
  return res;
};

export default function DataLakeDemo() {
  const { isDark } = useApp();
  const parentRef = useRef(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error
  } = useInfiniteQuery({
    queryKey: ['analytics_orders_1m'],
    queryFn: fetchOrders,
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.nextCursor : undefined,
    initialPageParam: null,
    maxPages: 5, // CRITICAL: Prevent RAM OOM by only keeping 5 pages (250 items) in memory
    staleTime: 30000,
  });

  const allRows = data ? data.pages.flatMap(d => d.data) : [];

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? allRows.length + 1 : allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated row height
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (lastItem.index >= allRows.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [virtualItems, allRows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle Circuit Breaker 503 Fallback
  if (status === 'error') {
    return (
      <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
        <Alert
          message="Hệ thống quá tải (Circuit Breaker Opened)"
          description={error.message || "Không thể kết nối đến ClickHouse. Hệ thống đã tự động ngắt mạch để bảo vệ CSDL."}
          type="error"
          showIcon
          icon={<WarningOutlined />}
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '120px 24px 48px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={2} style={{ color: isDark ? '#fff' : '#000', margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 12, color: '#10b981' }} />
          Data Lake Demo: 1,000,000 Records
        </Title>
        <Text style={{ color: isDark ? '#aaa' : '#666', fontSize: 16 }}>
          Kiến trúc Infinite Query + DOM Virtualization (O(1) Memory Footprint)
        </Text>
      </div>

      <Card
        style={{
          background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee',
          borderRadius: 16,
          overflow: 'hidden'
        }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '16px 24px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', display: 'flex', justifyContent: 'space-between', background: isDark ? 'rgba(0,0,0,0.2)' : '#f9f9f9', fontWeight: 600 }}>
          <div style={{ width: 120 }}>Mã Đơn</div>
          <div style={{ width: 200 }}>Khách Hàng</div>
          <div style={{ width: 150 }}>Ngày Đặt</div>
          <div style={{ width: 120, textAlign: 'right' }}>Tổng Tiền</div>
          <div style={{ width: 120, textAlign: 'right' }}>Trạng Thái</div>
        </div>

        {status === 'pending' ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : (
          <div
            ref={parentRef}
            style={{
              height: 700,
              overflow: 'auto',
              position: 'relative',
              contain: 'strict'
            }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {virtualItems.map((virtualRow) => {
                const isLoaderRow = virtualRow.index > allRows.length - 1;
                const order = allRows[virtualRow.index];

                return (
                  <div
                    key={virtualRow.index}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                      padding: '16px 24px',
                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: virtualRow.index % 2 === 0 ? (isDark ? 'transparent' : '#fff') : (isDark ? 'rgba(255,255,255,0.01)' : '#fafafa')
                    }}
                  >
                    {isLoaderRow ? (
                      <div style={{ width: '100%', textAlign: 'center', padding: 20 }}>
                        <Spin /> <span style={{ marginLeft: 12, color: '#888' }}>Đang tải thêm từ Data Lake...</span>
                      </div>
                    ) : (
                      <>
                        <div style={{ width: 120, fontWeight: 700, color: '#10b981' }}>{order.id}</div>
                        <div style={{ width: 200, color: isDark ? '#fff' : '#333' }}>{order.customer_name}</div>
                        <div style={{ width: 150, color: '#888', fontSize: 13 }}>{new Date(order.order_date).toLocaleString('vi-VN')}</div>
                        <div style={{ width: 120, textAlign: 'right', fontWeight: 600 }}>{order.total_amount.toLocaleString('vi-VN')} đ</div>
                        <div style={{ width: 120, textAlign: 'right' }}>
                          <Tag color={order.status === 'DELIVERED' ? 'success' : 'processing'}>
                            {order.status}
                          </Tag>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      <div style={{ textAlign: 'center', marginTop: 16, color: '#888' }}>
        *Thử nghiệm tải 1 triệu bản ghi không sập RAM bằng Virtualization
      </div>
    </div>
  );
}
