import { useState, useEffect } from 'react';
import { Typography, Table, Tag, Button, Modal, Input, message, Rate } from 'antd';
import { api } from '../services/api';

const { Title } = Typography;

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const data = await api.b2b.getReviews();
      setReviews(data);
    } catch (err) {
      message.error('Lỗi khi tải đánh giá: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openReplyModal = (review) => {
    setSelectedReview(review);
    setReplyContent(review.reply || '');
    setReplyModalOpen(true);
  };

  const submitReply = async () => {
    if (!replyContent.trim()) return message.error('Vui lòng nhập nội dung phản hồi');
    try {
      setSubmitting(true);
      await api.b2b.replyReview(selectedReview.id, replyContent);
      message.success('Đã gửi phản hồi');
      setReplyModalOpen(false);
      loadReviews();
    } catch (err) {
      message.error('Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Mã ĐG',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'Khách hàng',
      dataIndex: 'reviewer',
      key: 'reviewer',
    },
    {
      title: 'Đánh giá',
      dataIndex: 'rating',
      key: 'rating',
      render: (r) => <Rate disabled defaultValue={r} style={{ fontSize: 14, color: '#10b981' }} />
    },
    {
      title: 'Nội dung',
      dataIndex: 'comment',
      key: 'comment',
      width: 300,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'date',
      key: 'date',
      render: (d) => new Date(d).toLocaleString('vi-VN')
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_, record) => record.reply 
        ? <Tag color="green">Đã phản hồi</Tag> 
        : <Tag color="orange">Chờ phản hồi</Tag>
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Button type="primary" onClick={() => openReplyModal(record)}>
          {record.reply ? 'Sửa phản hồi' : 'Phản hồi'}
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Quản lý Đánh giá (Reviews)</Title>
      
      <div className="glass-panel" style={{ padding: 24, borderRadius: 16 }}>
        <Table 
          columns={columns} 
          dataSource={reviews} 
          rowKey="id" 
          loading={loading} 
        />
      </div>

      <Modal
        title="Phản hồi Đánh giá"
        open={replyModalOpen}
        onCancel={() => setReplyModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setReplyModalOpen(false)}>Hủy</Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={submitReply} style={{ background: '#10b981' }}>Gửi phản hồi</Button>
        ]}
      >
        {selectedReview && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <strong>{selectedReview.reviewer}</strong> đã đánh giá {selectedReview.rating} sao:<br/>
              <em>"{selectedReview.comment}"</em>
            </div>
            <Input.TextArea 
              rows={4} 
              value={replyContent} 
              onChange={e => setReplyContent(e.target.value)} 
              placeholder="Nhập nội dung phản hồi của cửa hàng..." 
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
