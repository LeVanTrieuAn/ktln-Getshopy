import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Cascader, Row, Col, InputNumber, Select, Space, Upload, message, Tabs, Popconfirm, DatePicker, Slider, Tooltip, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import dayjs from 'dayjs';

const cityOptions = [
  {
    value: 'Hà Nội', label: 'Hà Nội',
    children: [
      {
        value: 'Quận Ba Đình', label: 'Quận Ba Đình',
        children: [{ value: 'Phường Phúc Xá', label: 'Phường Phúc Xá' }, { value: 'Phường Trúc Bạch', label: 'Phường Trúc Bạch' }],
      },
      {
        value: 'Quận Đống Đa', label: 'Quận Đống Đa',
        children: [{ value: 'Phường Láng Hạ', label: 'Phường Láng Hạ' }, { value: 'Phường Ô Chợ Dừa', label: 'Phường Ô Chợ Dừa' }],
      },
    ],
  },
  {
    value: 'Hồ Chí Minh', label: 'Hồ Chí Minh',
    children: [
      {
        value: 'Quận 1', label: 'Quận 1',
        children: [{ value: 'Phường Bến Nghé', label: 'Phường Bến Nghé' }, { value: 'Phường Bến Thành', label: 'Phường Bến Thành' }],
      },
      {
        value: 'Quận 3', label: 'Quận 3',
        children: [{ value: 'Phường 1', label: 'Phường 1' }, { value: 'Phường 2', label: 'Phường 2' }],
      },
    ],
  },
  {
    value: 'Đà Nẵng', label: 'Đà Nẵng',
    children: [
      {
        value: 'Quận Hải Châu', label: 'Quận Hải Châu',
        children: [{ value: 'Phường Hải Châu I', label: 'Phường Hải Châu I' }, { value: 'Phường Thạch Thang', label: 'Phường Thạch Thang' }],
      },
    ],
  },
];

export default function GeneralManagement() {
  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(false);
  
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [brands, setBrands] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formBranch] = Form.useForm();
  const [formProduct] = Form.useForm();
  const [formFlashSale] = Form.useForm();
  const [formBrand] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [br, pr, cat, fs, brds] = await Promise.all([
        api.b2b.getBranches(),
        api.b2b.getProducts ? api.b2b.getProducts() : api.b2c.getProducts('ALL'),
        api.b2c.getCategories(),
        api.b2b.getFlashSales ? api.b2b.getFlashSales() : fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/b2b/flash-sales`).then(r => r.json()),
        api.b2b.getBrands ? api.b2b.getBrands() : api.b2c.getBrands()
      ]);
      setBranches(br);
      setProducts(pr);
      setCategories(cat);
      setFlashSales(fs);
      setBrands(brds);
    } catch(e) {
      console.error(e);
      message.error('Không thể tải dữ liệu');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Modal Handling ---
  const openModal = (item = null) => {
    setEditingItem(item);
    setModalOpen(true);
    if (item) {
      if (activeTab === '1') {
        formBranch.setFieldsValue({
          name: item.name,
          street: item.address,
        });
      } else if (activeTab === '2') {
        formProduct.setFieldsValue({
          name: item.name,
          price: item.price,
          category_id: item.category_id,
          image: item.image,
          images: item.images || [],
          branch_ids: item.branch_ids,
          stock: item.stock,
        });
      } else if (activeTab === '3') {
        formFlashSale.setFieldsValue({
          title: item.title,
          discount_percent: 10,
          time_range: [dayjs(item.start_time), dayjs(item.end_time)],
        });
      } else if (activeTab === '4') {
        formBrand.setFieldsValue({
          name: item.name,
        });
      }
    } else {
      formBranch.resetFields();
      formProduct.resetFields();
      formFlashSale.resetFields();
      formBrand.resetFields();
    }
  };

  const handleModalOk = () => {
    if (activeTab === '1') formBranch.submit();
    if (activeTab === '2') formProduct.submit();
    if (activeTab === '3') formFlashSale.submit();
    if (activeTab === '4') formBrand.submit();
  };

  // --- CRUD Handlers ---
  const handleBranchSubmit = async (values) => {
    try {
      const address = values.city_district_ward ? `${values.street}, ${values.city_district_ward.reverse().join(', ')}` : values.street;
      const payload = { name: values.name, address };
      if (editingItem) {
        await api.b2b.updateBranch(editingItem.id, payload);
        message.success('Cập nhật chi nhánh thành công!');
      } else {
        await api.b2b.addBranch(payload);
        message.success('Thêm chi nhánh thành công!');
      }
      setModalOpen(false);
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleBrandSubmit = async (values) => {
    try {
      if (editingItem) {
        await api.b2b.updateBrand(editingItem.id, values);
        message.success('Cập nhật thương hiệu thành công!');
      } else {
        await api.b2b.addBrand(values);
        message.success('Thêm thương hiệu thành công!');
      }
      setModalOpen(false);
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleProductSubmit = async (values) => {
    try {
      if (editingItem) {
        await api.b2b.updateProduct(editingItem.id, values);
        message.success('Cập nhật sản phẩm thành công!');
      } else {
        await api.b2b.addProduct(values);
        message.success('Thêm sản phẩm thành công!');
      }
      setModalOpen(false);
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleFlashSaleSubmit = async (values) => {
    try {
      const payload = { ...values };
      if (values.time_range) {
        payload.start_time = values.time_range[0].toISOString();
        payload.end_time = values.time_range[1].toISOString();
        delete payload.time_range;
      }
      if (editingItem) {
        await api.b2b.updateFlashSale(editingItem.id, payload);
        message.success('Cập nhật Flash Sale thành công!');
      } else {
        await api.b2b.addFlashSale(payload);
        message.success('Thêm Flash Sale thành công!');
      }
      setModalOpen(false);
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleDelete = async (id, type) => {
    try {
      if (type === 'branch') {
        await api.b2b.deleteBranch(id);
        message.success('Đã xóa chi nhánh');
      } else if (type === 'product') {
        await api.b2b.deleteProduct(id);
        message.success('Đã xóa sản phẩm');
      } else if (type === 'flash_sale') {
        await api.b2b.deleteFlashSale(id);
        message.success('Đã xóa Flash Sale');
      } else if (type === 'brand') {
        await api.b2b.deleteBrand(id);
        message.success('Đã xóa thương hiệu');
      }
      loadData();
    } catch (e) { message.error(e.message); }
  };

  const handleToggleBanner = async (id, checked) => {
    try {
      await api.b2b.updateProduct(id, { is_banner: checked });
      message.success(checked ? 'Đã thêm vào banner' : 'Đã gỡ khỏi banner');
      loadData();
    } catch (e) {
      message.error(e.message);
    }
  };

  // --- Table Columns ---
  const branchColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Tên chi nhánh', dataIndex: 'name', key: 'name' },
    { title: 'Địa chỉ', dataIndex: 'address', key: 'address' },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} size="small">Sửa</Button>
          <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.id, 'branch')}>
            <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const productColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Hình ảnh', dataIndex: 'image', key: 'image', render: (img) => <img src={img} alt="product" style={{width: 40, height: 40, objectFit: 'cover', borderRadius: 4}} /> },
    { title: 'Tên sản phẩm', dataIndex: 'name', key: 'name' },
    { title: 'Giá', dataIndex: 'price', key: 'price', render: (price) => `${price?.toLocaleString('vi-VN')} đ` },
    { title: 'Số lượng', dataIndex: 'stock', key: 'stock' },
    { 
      title: 'Chi nhánh', 
      dataIndex: 'branch_ids', 
      key: 'branch_ids', 
      render: (ids) => {
        if (!ids || !ids.length) return 'Tất cả';
        const uniqueBr = Array.from(new Map(branches.map(b => [b.id, b])).values());
        const names = ids.map(id => uniqueBr.find(b => b.id === id)?.name?.split(' - ').pop() || id);
        if (names.length <= 3) return names.join(', ');
        return (
          <Tooltip title={names.join(', ')}>
            <span>{names.slice(0, 3).join(', ')}...</span>
          </Tooltip>
        );
      } 
    },
    {
      title: 'Banner',
      dataIndex: 'is_banner',
      key: 'is_banner',
      render: (is_banner, record) => (
        <Switch checked={!!is_banner} onChange={(checked) => handleToggleBanner(record.id, checked)} />
      )
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} size="small">Sửa</Button>
          <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.id, 'product')}>
            <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const flashSaleColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Tên chương trình', dataIndex: 'title', key: 'title' },
    { title: 'Danh mục', dataIndex: 'category_id', key: 'category_id', render: (id) => categories.find(c => c.id === id)?.name || '-' },
    { title: 'Sản phẩm', dataIndex: 'product_id', key: 'product_id', render: (id) => products.find(p => p.id === id)?.name || '-' },
    { title: 'Giảm giá', dataIndex: 'discount_percent', key: 'discount_percent', render: (pct) => pct ? `${pct}%` : '-' },
    { title: 'Bắt đầu', dataIndex: 'start_time', key: 'start_time', render: (t) => dayjs(t).format('DD/MM/YYYY HH:mm') },
    { title: 'Kết thúc', dataIndex: 'end_time', key: 'end_time', render: (t) => dayjs(t).format('DD/MM/YYYY HH:mm') },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} size="small">Sửa</Button>
          <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.id, 'flash_sale')}>
            <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const brandColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Tên thương hiệu', dataIndex: 'name', key: 'name' },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => openModal(record)} size="small">Sửa</Button>
          <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.id, 'brand')}>
            <Button icon={<DeleteOutlined />} danger size="small">Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Quản lý chung</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
          Thêm mới
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: '1', label: 'Chi nhánh', children: <Table dataSource={branches} columns={branchColumns} rowKey="id" loading={loading} /> },
        { key: '4', label: 'Thương hiệu', children: <Table dataSource={brands} columns={brandColumns} rowKey="id" loading={loading} /> },
        { key: '2', label: 'Sản phẩm', children: <Table dataSource={products} columns={productColumns} rowKey="id" loading={loading} /> },
        { key: '3', label: 'Mã giảm (Flash Sale)', children: <Table dataSource={flashSales} columns={flashSaleColumns} rowKey="id" loading={loading} /> },
      ]} />

      <Modal
        title={editingItem ? "Sửa thông tin" : "Thêm mới"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleModalOk}
        okText="Lưu"
        cancelText="Hủy"
        width={600}
        destroyOnHidden
      >
        <div style={{ display: activeTab === '1' ? 'block' : 'none' }}>
          <Form form={formBranch} layout="vertical" onFinish={handleBranchSubmit}>
            <Form.Item name="name" label="Tên chi nhánh" rules={[{ required: true }]}>
              <Input placeholder="VD: Đà Nẵng - Hải Châu" />
            </Form.Item>
            <Form.Item name="city_district_ward" label="Thành phố / Quận Huyện / Phường Xã" rules={[{ required: !editingItem }]}>
              <Cascader options={cityOptions} placeholder="Chọn Thành phố, Quận/Huyện, Phường/Xã" />
            </Form.Item>
            <Form.Item name="street" label="Số nhà, Tên đường" rules={[{ required: true }]}>
              <Input placeholder="VD: 123 Đường Trần Hưng Đạo" />
            </Form.Item>
          </Form>
        </div>
        
        <div style={{ display: activeTab === '2' ? 'block' : 'none' }}>
          <Form form={formProduct} layout="vertical" onFinish={handleProductSubmit}>
            <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true }]}>
              <Input placeholder="Nhập tên sản phẩm..." />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="price" label="Giá bán (VNĐ)" rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} min={0} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="stock" label="Số lượng" initialValue={100} rules={[{ required: true }]}>
                  <InputNumber style={{ width: '100%' }} min={0} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="category_id" label="Danh mục" initialValue="c1">
                  <Select options={[
                    { value: 'c1', label: 'Điện thoại' },
                    { value: 'c2', label: 'Laptop' },
                    { value: 'c3', label: 'Máy tính bảng' },
                    { value: 'c4', label: 'Phụ kiện' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="brand_id" label="Thương hiệu" rules={[{ required: true, message: 'Vui lòng chọn Thương hiệu' }]}>
                  <Select 
                    showSearch
                    placeholder="Chọn thương hiệu" 
                    options={brands.map(b => ({ value: b.id, label: b.name }))}
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Hình ảnh sản phẩm (có thể thêm nhiều ảnh)">
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Ảnh bìa</div>
              <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                <Form.Item name="image" noStyle>
                  <Input placeholder="Nhập URL hoặc tải ảnh lên..." />
                </Form.Item>
                <Upload 
                  showUploadList={false} 
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = e => {
                      formProduct.setFieldsValue({ image: e.target.result });
                      message.success('Đã tải ảnh lên thành công!');
                    };
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} style={{ background: '#10b981', color: '#fff', border: 'none' }}>Tải lên</Button>
                </Upload>
              </Space.Compact>
              
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Ảnh phụ</div>
              <Form.List name="images">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map((field, index) => (
                      <Space.Compact key={field.key} style={{ width: '100%', marginBottom: 8 }}>
                        <Form.Item {...field} noStyle>
                          <Input placeholder={`Ảnh phụ ${index + 1}...`} />
                        </Form.Item>
                        <Upload 
                          showUploadList={false} 
                          beforeUpload={(file) => {
                            const reader = new FileReader();
                            reader.onload = e => {
                              const currentImages = formProduct.getFieldValue('images') || [];
                              currentImages[field.name] = e.target.result;
                              formProduct.setFieldsValue({ images: currentImages });
                              message.success('Đã tải ảnh lên thành công!');
                            };
                            reader.readAsDataURL(file);
                            return false;
                          }}
                        >
                          <Button icon={<UploadOutlined />} style={{ background: '#10b981', color: '#fff', border: 'none' }}>Tải lên</Button>
                        </Upload>
                        <Button danger onClick={() => remove(field.name)} icon={<DeleteOutlined />} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} />
                      </Space.Compact>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Thêm hình ảnh khác
                    </Button>
                  </>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item name="branch_ids" label="Chọn chi nhánh có sản phẩm này">
              <Select 
                mode="multiple" 
                allowClear
                placeholder="Chọn chi nhánh" 
                options={[
                  { value: 'ALL', label: 'Tất cả chi nhánh', style: { fontWeight: 'bold', color: '#10b981' } }, 
                  ...Array.from(new Map(branches.map(b => [b.id, b])).values()).map(b => ({ value: b.id, label: b.name }))
                ]} 
                onChange={(vals) => {
                  if (vals && vals.includes('ALL')) {
                    const allIds = branches.map(b => b.id);
                    formProduct.setFieldsValue({ branch_ids: allIds });
                  }
                }}
              />
            </Form.Item>
          </Form>
        </div>
        
        <div style={{ display: activeTab === '3' ? 'block' : 'none' }}>
          <Form form={formFlashSale} layout="vertical" onFinish={handleFlashSaleSubmit}>
            <Form.Item name="title" label="Tên chương trình" rules={[{ required: true }]}>
              <Input placeholder="VD: Khuyến mãi cuối tuần" />
            </Form.Item>
            <Form.Item 
                  name="category_id" 
                  label="Danh mục áp dụng"
                  dependencies={['product_id']}
                  rules={[{
                    validator: (_, value) => {
                      if (!value && !formFlashSale.getFieldValue('product_id')) {
                        return Promise.reject(new Error('Vui lòng chọn Danh mục hoặc Sản phẩm áp dụng'));
                      }
                      return Promise.resolve();
                    }
                  }]}
                >
                  <Select placeholder="Chọn danh mục áp dụng" options={categories.map(c => ({ value: c.id, label: c.name }))} allowClear />
                </Form.Item>
                <Form.Item 
                  name="product_id" 
                  label="Sản phẩm áp dụng"
                  dependencies={['category_id']}
                  rules={[{
                    validator: (_, value) => {
                      if (!value && !formFlashSale.getFieldValue('category_id')) {
                        return Promise.reject(new Error('Vui lòng chọn Danh mục hoặc Sản phẩm áp dụng'));
                      }
                      return Promise.resolve();
                    }
                  }]}
                >
                  <Select 
                    allowClear
                    showSearch 
                    placeholder="Chọn sản phẩm" 
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} 
                    options={products.map(p => ({ value: p.id, label: p.name }))} 
                    onChange={(val) => {
                      if (val) {
                        const prod = products.find(p => p.id === val);
                        if (prod && prod.category_id) {
                          formFlashSale.setFieldsValue({ category_id: prod.category_id });
                        }
                      }
                      formFlashSale.validateFields(['category_id']);
                    }}
                  />
                </Form.Item>
            <Form.Item 
              name="time_range" 
              label="Thời hạn khuyến mãi" 
              rules={[{ required: true, message: 'Vui lòng chọn thời gian bắt đầu và kết thúc' }]}
            >
              <DatePicker.RangePicker 
                showTime={{ format: 'HH:mm:ss' }} 
                format="YYYY-MM-DD HH:mm:ss" 
                style={{ width: '100%' }} 
                placeholder={['Ngày bắt đầu', 'Ngày kết thúc']} 
              />
            </Form.Item>
            <Form.Item name="discount_percent" initialValue={10} hidden>
              <Input />
            </Form.Item>
            <Form.Item label="Phần trăm khuyến mãi (%)" required>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.discount_percent !== curr.discount_percent}
              >
                {({ getFieldValue, setFieldsValue }) => {
                  const val = getFieldValue('discount_percent') || 10;
                  return (
                    <Row gutter={16}>
                      <Col span={18}>
                        <Slider
                          min={1}
                          max={99}
                          marks={{ 10: '10%', 30: '30%', 50: '50%', 70: '70%', 90: '90%' }}
                          value={val}
                          onChange={(v) => setFieldsValue({ discount_percent: v })}
                        />
                      </Col>
                      <Col span={6}>
                        <InputNumber
                          min={1}
                          max={99}
                          style={{ width: '100%' }}
                          formatter={(value) => `${value}%`}
                          parser={(value) => value?.replace('%', '')}
                          value={val}
                          onChange={(v) => setFieldsValue({ discount_percent: v })}
                        />
                      </Col>
                    </Row>
                  );
                }}
              </Form.Item>
            </Form.Item>
          </Form>
        </div>
        
        <div style={{ display: activeTab === '4' ? 'block' : 'none' }}>
          <Form form={formBrand} layout="vertical" onFinish={handleBrandSubmit}>
            <Form.Item name="name" label="Tên thương hiệu" rules={[{ required: true }]}>
              <Input placeholder="VD: Apple" />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
