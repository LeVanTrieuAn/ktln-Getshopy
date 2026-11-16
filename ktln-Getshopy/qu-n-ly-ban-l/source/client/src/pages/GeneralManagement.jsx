import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Cascader, Row, Col, InputNumber, Select, Space, Upload, message, Tabs, Popconfirm, DatePicker, Slider, Tooltip, Switch, Tag, Checkbox, Drawer, Descriptions, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, StopOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import { fullNameRules, phoneRules } from '../utils/validators';
import dayjs from 'dayjs';

// Trần điểm khi quản trị nhập — cùng số với LOYALTY_POINTS_MAX ở server/src/services/customerAdmin.js.
const LOYALTY_POINTS_MAX = 1000000;

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
  // `products` giờ là MỘT TRANG, không phải cả catalog.
  const [products, setProducts] = useState([]);
  const [productPage, setProductPage] = useState({ current: 1, pageSize: 20, total: 0 });
  const [productSearch, setProductSearch] = useState('');
  // Bảng tra tên riêng cho các sản phẩm được flash sale tham chiếu. Chúng
  // hiếm khi nằm trong trang đang xem, nên phải nạp theo id.
  const [productNames, setProductNames] = useState({});
  // Danh sách cho ô chọn sản phẩm trong form flash sale — nạp theo từ khoá.
  const [productOptions, setProductOptions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [brands, setBrands] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerPage, setCustomerPage] = useState({ current: 1, pageSize: 20, total: 0 });
  const [customerSearch, setCustomerSearch] = useState('');
  // Quản lý khách hàng (16/11/2026): modal thêm/sửa RIÊNG (không dùng chung modal của các tab
  // khác — tiêu đề, nút và luật ô email khác hẳn), bộ lọc trạng thái, ngăn chi tiết.
  const [customerStatusFilter, setCustomerStatusFilter] = useState('all');
  const [customerModal, setCustomerModal] = useState({ open: false, editing: null });
  const [customerSaving, setCustomerSaving] = useState(false);
  const [customerDetail, setCustomerDetail] = useState({ open: false, loading: false, data: null });
  const [formCustomer] = Form.useForm();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formBranch] = Form.useForm();
  const [formProduct] = Form.useForm();
  const [formFlashSale] = Form.useForm();
  const [formBrand] = Form.useForm();

  // AI Assistant states
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const loadAiSuggestion = async () => {
    setLoadingAi(true);
    try {
      const res = await api.ai.getCampaignSuggestions();
      setAiSuggestion(res.suggestion);
    } catch (err) {
      message.error(err.message || 'Không thể tải đề xuất AI. Bạn đã nhập API Key chưa?');
    }
    setLoadingAi(false);
  };

  const handleApplyAiSuggestion = () => {
    formFlashSale.setFieldsValue({
      title: aiSuggestion.title,
      discount_percent: aiSuggestion.discount_percent,
      product_id: aiSuggestion.product_id
    });
    // Find category from product
    const prod = products.find(p => p.id === aiSuggestion.product_id);
    if (prod && prod.category_id) {
      formFlashSale.setFieldsValue({ category_id: prod.category_id });
    }
    setEditingItem(null);
    setModalOpen(true);
  };

  // Nạp một trang sản phẩm từ máy chủ. Mọi thao tác lọc/phân trang đều đi
  // qua đây — không lọc phía client vì client chỉ giữ 20 dòng.
  const loadProducts = useCallback(async (page = 1, pageSize = 20, search = '') => {
    try {
      const res = await api.b2b.getProducts({ page, limit: pageSize, search });
      setProducts(res.data || []);
      setProductPage({ current: res.page || page, pageSize, total: res.total || 0 });
    } catch (e) { console.error(e); }
  }, []);

  // Khách hàng: cũng phân trang ở máy chủ (40.008 dòng — trước đây nạp hết một lần).
  const loadCustomers = useCallback(async (page = 1, pageSize = 20, search = '', status = 'all') => {
    try {
      const res = await api.b2b.getCustomers({ page, limit: pageSize, search, status });
      setCustomers(res.data || []);
      setCustomerPage({ current: res.page || page, pageSize, total: res.total || 0 });
    } catch (e) { console.error(e); message.error(e.message || 'Không tải được danh sách khách hàng'); }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [br, pr, cat, fs, brds, cust] = await Promise.all([
        api.b2b.getBranches(),
        api.b2b.getProducts({ page: 1, limit: 20 }),
        api.b2c.getCategories(),
        api.b2b.getFlashSales ? api.b2b.getFlashSales() : fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/b2b/flash-sales`).then(r => r.json()),
        api.b2b.getBrands ? api.b2b.getBrands() : api.b2c.getBrands(),
        api.b2b.getCustomers({ page: 1, limit: 20 })
      ]);
      setBranches(br);
      setProducts(pr.data || []);
      setProductPage(pp => ({ ...pp, current: 1, total: pr.total || 0 }));
      setCategories(cat);
      setFlashSales(fs);
      setBrands(brds);
      setCustomers(cust.data || []);
      setCustomerPage(cp => ({ ...cp, current: 1, total: cust.total || 0 }));
      // Danh sách vừa nạp là "tất cả trạng thái" — ô lọc phải khớp với nó.
      setCustomerStatusFilter('all');
    } catch(e) {
      console.error(e);
      message.error('Không thể tải dữ liệu');
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Flash sale trỏ tới sản phẩm bất kỳ trong 600.000 cái; trang đang xem chỉ
  // có 20. Nạp riêng đúng những id được tham chiếu để cột "Sản phẩm" không
  // hiện dấu gạch ngang.
  useEffect(() => {
    const ids = [...new Set(flashSales.map(f => f.product_id).filter(Boolean))];
    const missing = ids.filter(id => !(id in productNames));
    if (missing.length === 0) return;
    api.b2b.getProductsByIds(missing)
      .then(res => setProductNames(prev => ({
        ...prev,
        ...Object.fromEntries((res.data || []).map(p => [p.id, p.name])),
      })))
      .catch(console.error);
  }, [flashSales, productNames]);

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

  // --- Khách hàng (16/11/2026) ---
  // Nạp lại trang đang xem, giữ ô tìm và bộ lọc trạng thái.
  const reloadCustomers = (page = customerPage.current) =>
    loadCustomers(page, customerPage.pageSize, customerSearch, customerStatusFilter);

  // Modal luôn được render (forceRender), nên resetFields + setFieldsValue áp ngay; không dùng
  // destroyOnHidden vì Form mount lại sẽ trộn giá trị cũ còn trong store vào initialValues.
  const openCustomerModal = (record = null) => {
    formCustomer.resetFields();
    if (record) {
      formCustomer.setFieldsValue({
        full_name: record.full_name,
        email: record.email,
        phone: record.phone || '',
        loyalty_points: record.loyalty_points ?? 0,
      });
    }
    setCustomerModal({ open: true, editing: record });
  };

  const closeCustomerModal = () => setCustomerModal({ open: false, editing: null });

  const handleCustomerSubmit = async (values) => {
    const editing = customerModal.editing;
    setCustomerSaving(true);
    try {
      if (editing) {
        const payload = {
          full_name: values.full_name,
          phone: values.phone || '',
          loyalty_points: values.loyalty_points ?? 0,
        };
        // Tài khoản có Google: server từ chối đổi email, nên không gửi ô (đang bị khoá) lên.
        if (editing.email_editable) payload.email = values.email;
        const res = await api.b2b.updateCustomer(editing.id, payload);
        message.success(res?.changed === false ? 'Không có thay đổi nào' : 'Đã cập nhật khách hàng');
        closeCustomerModal();
        reloadCustomers();
      } else {
        const res = await api.b2b.addCustomer({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || '',
          loyalty_points: values.loyalty_points ?? 0,
          send_welcome_email: !!values.send_welcome_email,
        });
        message.success('Đã tạo khách hàng');
        // Tạo khách không bao giờ hỏng vì email; server báo riêng thư đã gửi được hay chưa.
        const notice = res?.email;
        if (notice?.sent) message.success(notice.message);
        else if (notice && notice.code !== 'NOT_REQUESTED') message.warning({ content: notice.message, duration: 10 });
        closeCustomerModal();
        reloadCustomers(1);
      }
    } catch (e) {
      message.error(e.message);
    } finally {
      setCustomerSaving(false);
    }
  };

  const openCustomerDetail = async (id) => {
    setCustomerDetail({ open: true, loading: true, data: null });
    try {
      const data = await api.b2b.getCustomer(id);
      setCustomerDetail({ open: true, loading: false, data });
    } catch (e) {
      message.error(e.message);
      setCustomerDetail({ open: false, loading: false, data: null });
    }
  };

  // "Xoá" khách = vô hiệu hoá: không xoá dòng nào, đơn và điểm giữ nguyên, kích hoạt lại được.
  const handleCustomerStatus = async (record, active) => {
    try {
      await api.b2b.setCustomerActive(record.id, active);
      message.success(active ? `Đã kích hoạt lại tài khoản ${record.email}` : `Đã vô hiệu hoá tài khoản ${record.email}`);
      reloadCustomers();
      if (customerDetail.open && customerDetail.data?.id === record.id) openCustomerDetail(record.id);
    } catch (e) {
      message.error(e.message);
    }
  };

  const customerEditing = customerModal.editing;
  const customerEmailLocked = !!customerEditing && !customerEditing.email_editable;

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
        let arr = ids;
        if (typeof arr === 'string') {
          try { arr = JSON.parse(arr); } catch(e) { arr = []; }
        }
        if (!Array.isArray(arr) || !arr.length) return 'Tất cả';
        const uniqueBr = Array.from(new Map(branches.map(b => [b.id, b])).values());
        const names = arr.map(id => uniqueBr.find(b => b.id === id)?.name?.split(' - ').pop() || id);
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
    { title: 'Sản phẩm', dataIndex: 'product_id', key: 'product_id', render: (id) => productNames[id] || products.find(p => p.id === id)?.name || (id ? `#${id}` : '-') },
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

  const customerColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id' },
    { title: 'Họ tên', dataIndex: 'full_name', key: 'full_name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone', render: (val) => val || '-' },
    { title: 'Điểm tích lũy', dataIndex: 'loyalty_points', key: 'loyalty_points', render: (val) => <Tag color="gold">{Number(val || 0).toLocaleString('vi-VN')}</Tag> },
    { title: 'Đăng nhập', dataIndex: 'provider', key: 'provider' },
    { title: 'Ngày tham gia', dataIndex: 'created_at', key: 'created_at', render: (t) => dayjs(t).format('DD/MM/YYYY') },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active, record) => (active
        ? <Tag color="green">Hoạt động</Tag>
        : (
          <Tooltip title={record.deactivated_at ? `Vô hiệu hoá lúc ${dayjs(record.deactivated_at).format('HH:mm DD/MM/YYYY')}` : null}>
            <Tag color="red">Đã vô hiệu hoá</Tag>
          </Tooltip>
        )),
    },
    {
      title: 'Hành động',
      key: 'action',
      render: (_, record) => (
        <Space size="small" wrap>
          <Button icon={<EyeOutlined />} onClick={() => openCustomerDetail(record.id)} size="small">Chi tiết</Button>
          <Button icon={<EditOutlined />} onClick={() => openCustomerModal(record)} size="small">Sửa</Button>
          {record.is_active ? (
            <Popconfirm
              title="Vô hiệu hoá tài khoản này?"
              description="Khách sẽ không đăng nhập, đặt hàng hay đặt lại mật khẩu được. Đơn hàng và điểm vẫn giữ nguyên; có thể kích hoạt lại."
              okText="Vô hiệu hoá"
              okButtonProps={{ danger: true }}
              cancelText="Hủy"
              onConfirm={() => handleCustomerStatus(record, false)}
            >
              <Button icon={<StopOutlined />} danger size="small">Vô hiệu hoá</Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title="Kích hoạt lại tài khoản này?"
              okText="Kích hoạt lại"
              cancelText="Hủy"
              onConfirm={() => handleCustomerStatus(record, true)}
            >
              <Button icon={<CheckCircleOutlined />} size="small">Kích hoạt lại</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const customerDetailItems = (c) => [
    { key: 'id', label: 'ID', children: c.id },
    { key: 'full_name', label: 'Họ tên', children: c.full_name },
    { key: 'email', label: 'Email', children: c.email },
    { key: 'phone', label: 'Số điện thoại', children: c.phone || '-' },
    { key: 'provider', label: 'Đăng nhập bằng', children: c.provider },
    {
      key: 'status',
      label: 'Trạng thái',
      children: c.is_active
        ? <Tag color="green">Hoạt động</Tag>
        : <span><Tag color="red">Đã vô hiệu hoá</Tag>{c.deactivated_at ? dayjs(c.deactivated_at).format('HH:mm DD/MM/YYYY') : ''}</span>,
    },
    { key: 'points', label: 'Điểm tích lũy', children: Number(c.loyalty_points || 0).toLocaleString('vi-VN') },
    { key: 'created_at', label: 'Ngày tham gia', children: dayjs(c.created_at).format('DD/MM/YYYY') },
    { key: 'orders', label: 'Số đơn', children: Number(c.stats?.order_count || 0).toLocaleString('vi-VN') },
    { key: 'paid', label: 'Đơn đã thanh toán', children: Number(c.stats?.paid_order_count || 0).toLocaleString('vi-VN') },
    { key: 'spent', label: 'Đã chi tiêu', children: `${Number(c.stats?.total_spent || 0).toLocaleString('vi-VN')} đ` },
    { key: 'last', label: 'Đơn gần nhất', children: c.stats?.last_order_date ? dayjs(c.stats.last_order_date).format('HH:mm DD/MM/YYYY') : '-' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Quản lý chung</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => (activeTab === '5' ? openCustomerModal() : openModal())}>
          Thêm mới
        </Button>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: '1', label: 'Chi nhánh', children: <Table dataSource={branches} columns={branchColumns} rowKey="id" loading={loading} /> },
        { key: '4', label: 'Thương hiệu', children: <Table dataSource={brands} columns={brandColumns} rowKey="id" loading={loading} /> },
        { key: '5', label: 'Khách hàng', children: (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <Input.Search
                allowClear
                placeholder="Tìm theo tên, email, số điện thoại hoặc ID…"
                onSearch={(v) => { setCustomerSearch(v); loadCustomers(1, customerPage.pageSize, v, customerStatusFilter); }}
                style={{ maxWidth: 360, flex: '1 1 240px' }}
              />
              <Select
                value={customerStatusFilter}
                onChange={(v) => { setCustomerStatusFilter(v); loadCustomers(1, customerPage.pageSize, customerSearch, v); }}
                style={{ width: 200 }}
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'inactive', label: 'Đã vô hiệu hoá' },
                ]}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCustomerModal()} style={{ marginLeft: 'auto' }}>
                Thêm khách hàng
              </Button>
            </div>
            <Table
              dataSource={customers} columns={customerColumns} rowKey="id" loading={loading}
              scroll={{ x: 'max-content' }}
              pagination={{
                current: customerPage.current,
                pageSize: customerPage.pageSize,
                total: customerPage.total,
                showSizeChanger: true,
                pageSizeOptions: [20, 50, 100],
                showTotal: (t) => `${t.toLocaleString('vi-VN')} khách hàng`,
                onChange: (pg, size) => loadCustomers(pg, size, customerSearch, customerStatusFilter),
              }}
            />
          </>
        ) },
        { key: '2', label: 'Sản phẩm', children: (
          <>
            <Input.Search
              allowClear
              placeholder="Tìm theo tên sản phẩm…"
              // Tìm ở MÁY CHỦ. Lọc phía client vô nghĩa khi client chỉ giữ 20 dòng.
              onSearch={(v) => { setProductSearch(v); loadProducts(1, productPage.pageSize, v); }}
              style={{ maxWidth: 360, marginBottom: 12 }}
            />
            <Table
              dataSource={products} columns={productColumns} rowKey="id" loading={loading}
              pagination={{
                current: productPage.current,
                pageSize: productPage.pageSize,
                total: productPage.total,
                showSizeChanger: true,
                pageSizeOptions: [20, 50, 100],
                showTotal: (t) => `${t.toLocaleString('vi-VN')} sản phẩm`,
                onChange: (pg, size) => loadProducts(pg, size, productSearch),
              }}
            />
          </>
        ) },
        { key: '3', label: 'Mã giảm (Flash Sale)', children: (
          <div>
            <div style={{ background: '#faf5ff', padding: 20, borderRadius: 12, marginBottom: 20, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#6b21a8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700 }}>
                  <span style={{ fontSize: 24 }}>✨</span> AI Campaign Assistant
                </h3>
                {!aiSuggestion && (
                  <Button type="primary" style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }} loading={loadingAi} onClick={loadAiSuggestion}>
                    Phân tích & Đề xuất chiến dịch
                  </Button>
                )}
              </div>
              
              {aiSuggestion && (
                <div style={{ marginTop: 16, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f3e8ff' }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Chiến dịch đề xuất: {aiSuggestion.title}</div>
                  <div style={{ margin: '8px 0', display: 'flex', gap: 12 }}>
                    <Tag color="purple">Giảm {aiSuggestion.discount_percent}%</Tag>
                    <Tag color="blue">Sản phẩm ID: {aiSuggestion.product_id}</Tag>
                  </div>
                  <div style={{ color: '#4b5563', fontSize: 14 }}><strong>Lý do:</strong> {aiSuggestion.reason}</div>
                  <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                    <Button type="primary" style={{ background: '#8b5cf6' }} onClick={handleApplyAiSuggestion}>
                      Áp dụng & Tạo chiến dịch ngay
                    </Button>
                    <Button onClick={() => setAiSuggestion(null)}>Đề xuất khác</Button>
                  </div>
                </div>
              )}
            </div>
            <Table dataSource={flashSales} columns={flashSaleColumns} rowKey="id" loading={loading} />
          </div>
        ) },
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
                    // filterOption={false}: để MÁY CHỦ lọc. Giữ mặc định thì antd
                    // chỉ lọc trong đám options đang có, mà đó chỉ là kết quả của
                    // lần tìm gần nhất — người dùng gõ tiếp sẽ thấy danh sách rỗng.
                    filterOption={false}
                    onSearch={(kw) => {
                      if (!kw) return;
                      api.b2b.getProducts({ page: 1, limit: 30, search: kw })
                        .then(r => setProductOptions((r.data || []).map(p => ({ value: p.id, label: p.name, category_id: p.category_id }))))
                        .catch(console.error);
                    }}
                    notFoundContent={<span style={{ color: '#999' }}>Gõ để tìm sản phẩm</span>}
                    options={productOptions.length ? productOptions : products.map(p => ({ value: p.id, label: p.name, category_id: p.category_id }))}
                    onChange={(val) => {
                      if (val) {
                        const prod = [...productOptions, ...products].find(p => (p.value ?? p.id) === val);
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

      {/* Thêm / sửa khách hàng (16/11/2026). Không có ô mật khẩu: server tự sinh mật khẩu ngẫu
          nhiên, khách tự đặt mật khẩu bằng "Quên mật khẩu?" ở cửa hàng. */}
      <Modal
        title={customerEditing ? `Sửa khách hàng #${customerEditing.id}` : 'Thêm khách hàng'}
        open={customerModal.open}
        onCancel={closeCustomerModal}
        onOk={() => formCustomer.submit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={customerSaving}
        forceRender
      >
        <Form
          form={formCustomer}
          layout="vertical"
          onFinish={handleCustomerSubmit}
          initialValues={{ loyalty_points: 0, send_welcome_email: true }}
        >
          <Form.Item name="full_name" label="Họ và tên" rules={fullNameRules}>
            <Input placeholder="VD: Nguyễn Văn An" maxLength={100} />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, whitespace: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
            extra={customerEmailLocked
              ? 'Tài khoản đăng nhập bằng Google: email gắn với tài khoản Google nên không đổi được.'
              : 'Khách dùng email này để đăng nhập và nhận mã đặt lại mật khẩu.'}
          >
            <Input type="email" placeholder="VD: an.nguyen@gmail.com" disabled={customerEmailLocked} autoComplete="off" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại (không bắt buộc)" rules={phoneRules(false)}>
            <Input inputMode="tel" placeholder="VD: 0912345678" />
          </Form.Item>
          <Form.Item
            name="loyalty_points"
            label="Điểm tích lũy"
            rules={[{ required: true, message: 'Vui lòng nhập điểm (0 nếu không có)' }]}
            extra="1 điểm = 1.000 đ khi khách dùng để giảm giá. Mọi thay đổi được ghi vào sổ điểm."
          >
            <InputNumber min={0} max={LOYALTY_POINTS_MAX} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          {!customerEditing && (
            <>
              <Form.Item name="send_welcome_email" valuePropName="checked">
                <Checkbox>Gửi email hướng dẫn đặt mật khẩu</Checkbox>
              </Form.Item>
              <Alert
                type="info"
                showIcon
                message='Hệ thống tự tạo mật khẩu ngẫu nhiên và không hiển thị cho ai. Khách tự đặt mật khẩu bằng "Quên mật khẩu?" ở cửa hàng.'
              />
            </>
          )}
        </Form>
      </Modal>

      <Drawer
        title="Chi tiết khách hàng"
        open={customerDetail.open}
        loading={customerDetail.loading}
        onClose={() => setCustomerDetail({ open: false, loading: false, data: null })}
        width="min(520px, 100vw)"
        destroyOnHidden
        extra={customerDetail.data ? (
          // Đóng ngăn trước: modal (forceRender) nằm ở portal tạo sớm hơn nên sẽ bị ngăn che.
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              const c = customerDetail.data;
              setCustomerDetail({ open: false, loading: false, data: null });
              openCustomerModal(c);
            }}
          >
            Sửa
          </Button>
        ) : null}
      >
        {customerDetail.data && (
          <Descriptions column={1} size="small" bordered items={customerDetailItems(customerDetail.data)} />
        )}
      </Drawer>
    </div>
  );
}
