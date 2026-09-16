import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Tag, Button, Modal, Form, Input, InputNumber, message, Space, Typography, Descriptions, Alert } from 'antd';
import { api } from '../../services/api';

const { Text } = Typography;

/**
 * Hàng đợi đối soát thanh toán.
 *
 * Mọi giao dịch không gán được vào đơn còn hiệu lực đều nằm lại đây chờ người
 * thật xử lý — nguyên tắc xuyên suốt phần thanh toán là KHÔNG BAO GIỜ im lặng
 * bỏ qua tiền. Không có màn hình này thì tiền của khách rơi vào chỗ không ai
 * nhìn thấy.
 */

// Nghĩa của từng trạng thái, để admin biết phải làm gì chứ không chỉ thấy mã
const STATUS_META = {
  MATCHED:         { color: 'success',    text: 'Đã khớp',        hint: 'Không cần làm gì' },
  LATE_MATCHED:    { color: 'cyan',       text: 'Khớp muộn',      hint: 'Đơn đã hết hạn nhưng giữ chỗ lại được' },
  UNMATCHED:       { color: 'warning',    text: 'Chưa khớp',      hint: 'Chưa tìm ra đơn — job re-match còn quét lại, chờ thêm' },
  REFUND_REQUIRED: { color: 'error',      text: 'Cần hoàn tiền',  hint: 'Tiền đã vào nhưng không gán được vào đơn nào' },
  DUPLICATE:       { color: 'error',      text: 'Tiền thừa',      hint: 'Đơn đã thanh toán trước đó — khách chuyển hai lần' },
  REFUNDED:        { color: 'default',    text: 'Đã hoàn',        hint: 'Đã xử lý xong' },
};

const money = (n) => (n ?? 0).toLocaleString('vi-VN') + ' đ';

export default function PaymentQueue({ isDark }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.payments.queue());
    } catch (err) {
      message.error(err.message || 'Không tải được hàng đợi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitRefund = async (values) => {
    try {
      const res = await api.payments.refund(refundTarget.id, values);
      message.success(`Đã ghi nhận hoàn ${money(res.refunded_amount)}`);
      setRefundTarget(null);
      form.resetFields();
      await load();
    } catch (err) {
      message.error(err.message || 'Ghi nhận hoàn tiền thất bại');
    }
  };

  const columns = [
    {
      title: 'Thời điểm', dataIndex: 'received_at', width: 150,
      render: (v) => new Date(v).toLocaleString('vi-VN'),
    },
    {
      title: 'Số tiền', dataIndex: 'amount', width: 130, align: 'right',
      render: (v) => <strong>{money(v)}</strong>,
    },
    {
      title: 'Nội dung chuyển khoản', dataIndex: 'content', ellipsis: true,
      render: (v, r) => (
        <div>
          <div style={{ fontSize: 13 }}>{v || <Text type="secondary">(trống)</Text>}</div>
          {/* content_norm là chuỗi sau chuẩn hoá — khi đối soát sai thì đây là
              thứ duy nhất truy được vì sao không tìm ra mã */}
          {r.content_norm && (
            <Text type="secondary" style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
              {r.content_norm}
            </Text>
          )}
        </div>
      ),
    },
    { title: 'Đơn hàng', dataIndex: 'order_id', width: 170,
      render: (v) => v || <Text type="secondary">—</Text> },
    {
      title: 'Trạng thái', dataIndex: 'match_status', width: 140,
      render: (v) => {
        const m = STATUS_META[v] || { color: 'default', text: v, hint: '' };
        return <Tag color={m.color} title={m.hint}>{m.text}</Tag>;
      },
    },
    {
      title: '', width: 130, align: 'right',
      render: (_, r) =>
        ['REFUND_REQUIRED', 'DUPLICATE'].includes(r.match_status) ? (
          <Button size="small" danger onClick={() => { setRefundTarget(r); form.setFieldsValue({ amount: r.amount }); }}>
            Đã hoàn tiền
          </Button>
        ) : r.match_status === 'REFUNDED' ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.refunded_at ? new Date(r.refunded_at).toLocaleDateString('vi-VN') : ''}
          </Text>
        ) : null,
    },
  ];

  const needAction = rows.filter((r) => ['REFUND_REQUIRED', 'DUPLICATE'].includes(r.match_status)).length;

  return (
    <Card
      title={<Space>Hàng đợi đối soát thanh toán
        {needAction > 0 && <Tag color="error">{needAction} cần xử lý</Tag>}</Space>}
      extra={<Button onClick={load} loading={loading}>Tải lại</Button>}
      style={{ background: isDark ? '#18181b' : '#fff', marginBottom: 24 }}
    >
      {needAction > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`${needAction} giao dịch cần hoàn tiền cho khách`}
          description="Tiền đã vào tài khoản nhưng không gán được vào đơn nào còn hiệu lực. Chuyển trả khách rồi bấm 'Đã hoàn tiền' để khép lại."
        />
      )}

      <Table
        columns={columns} dataSource={rows} rowKey="id" loading={loading}
        size="small" pagination={{ pageSize: 20 }}
        locale={{ emptyText: 'Không có giao dịch nào cần xử lý' }}
      />

      <Modal
        open={!!refundTarget}
        title="Ghi nhận đã hoàn tiền"
        onCancel={() => { setRefundTarget(null); form.resetFields(); }}
        onOk={() => form.submit()}
        okText="Xác nhận đã hoàn"
        okButtonProps={{ danger: true }}
      >
        {refundTarget && (
          <>
            <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Giao dịch">{refundTarget.provider_txn_id}</Descriptions.Item>
              <Descriptions.Item label="Số tiền nhận">{money(refundTarget.amount)}</Descriptions.Item>
              <Descriptions.Item label="Nội dung">{refundTarget.content || '—'}</Descriptions.Item>
            </Descriptions>
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message="Chuyển tiền cho khách TRƯỚC, rồi mới ghi nhận ở đây."
              description="Thao tác này chỉ đánh dấu đã hoàn — không tự chuyển tiền. Mỗi giao dịch chỉ hoàn được một lần."
            />
            <Form form={form} layout="vertical" onFinish={submitRefund}>
              <Form.Item
                name="amount" label="Số tiền hoàn"
                rules={[{ required: true, message: 'Nhập số tiền' }]}
              >
                <InputNumber
                  style={{ width: '100%' }} min={1} max={refundTarget.amount}
                  formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                  parser={(v) => v.replace(/\./g, '')}
                />
              </Form.Item>
              <Form.Item name="refund_ref" label="Mã giao dịch hoàn (ngân hàng)">
                <Input placeholder="FT2026091300123" />
              </Form.Item>
              <Form.Item name="note" label="Ghi chú">
                <Input.TextArea rows={2} placeholder="Lý do hoàn tiền" />
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </Card>
  );
}
