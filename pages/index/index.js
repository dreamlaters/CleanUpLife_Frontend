/**
 * 首页逻辑处理
 * 管理物品列表、待购物品、出行目的地
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    // 物品列表
    products: [],
    swipeIndex: -1,
    
    // 待购物品
    toBuyProducts: [],
    toBuySwipeIndex: -1,
    
    // 出行模块
    travelTab: 'pending',
    travelList: [],
    travelSwipeIndex: -1,
    showTravelForm: false,
    travelFormTypeIndex: 0,
    travelFormName: '',
    travelFormPriority: 1,
    travelRegion: [],
    travelRegionDisplay: '',
    travelCountryIndex: 0,
    
    // 常量数据
    countryList: constants.COUNTRY_LIST,
    
    // 触摸状态
    touchStartX: 0,
    touchStartY: 0,
    isVerticalScroll: false,
    
    // 排序状态
    sortField: '',
    sortOrder: 'asc'
  },

  // ==================== 生命周期 ====================
  onLoad() {
    this._fetchAllData();
  },

  onShow() {
    this._fetchAllData();
  },

  // 获取所有数据
  _fetchAllData() {
    this.fetchProducts();
    this.fetchToBuyProducts();
    this.fetchTravelList();
  },

  // ==================== 物品列表 ====================
  fetchProducts() {
    api.get('/Products', { loadingText: '加载中...' })
      .then(data => {
        const products = (data || []).map(item => ({
          ...item,
          bestByFormatted: util.formatDate(item.bestBy),
          dateClass: util.getDateClass(item.bestBy),
          emoji: constants.CATEGORY_EMOJI[item.category] || ''
        }));
        this.setData({ products });
      })
      .catch(() => {
        util.showError('数据加载失败');
      });
  },

  // 删除物品
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    util.showConfirm('确认删除', '确定要删除该物品吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/Products/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchProducts();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  // 更新物品
  onUpdate(e) {
    const { id, category = 'Product' } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/update/update?id=${id}&category=${category}`
    });
  },

  // 跳转添加页面
  goToTarget() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  // 排序处理
  onSortByName() {
    this._sortProducts('name');
  },

  onSortByBestBy() {
    this._sortProducts('bestBy');
  },

  _sortProducts(field) {
    const { sortField, sortOrder, products } = this.data;
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    
    const sortedProducts = [...products].sort((a, b) => {
      if (field === 'name') {
        return newOrder === 'asc' 
          ? a.name.localeCompare(b.name, 'zh')
          : b.name.localeCompare(a.name, 'zh');
      }
      return newOrder === 'asc' 
        ? (a[field] > b[field] ? 1 : -1)
        : (a[field] < b[field] ? 1 : -1);
    });

    this.setData({
      products: sortedProducts,
      sortField: field,
      sortOrder: newOrder
    });
  },

  // ==================== 待购物品 ====================
  fetchToBuyProducts() {
    api.get('/ToBuy', { showLoading: false })
      .then(data => {
        const list = (data || [])
          .map(item => ({
            ...item,
            priority: item.priority ?? item.Priority ?? 0,
            name: item.name ?? item.Name ?? ''
          }))
          .sort((a, b) => a.priority - b.priority);
        this.setData({ toBuyProducts: list });
      });
  },

  goToAddToBuy() {
    wx.navigateTo({ url: '/pages/tobuy/add' });
  },

  onDeleteToBuy(e) {
    const id = e.currentTarget.dataset.id;
    util.showConfirm('确认删除', '确定要删除该待购物品吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/ToBuy/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchToBuyProducts();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  onUpdateToBuy(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/tobuy/update?id=${id}` });
  },

  // ==================== 出行模块 ====================
  fetchTravelList() {
    const status = this.data.travelTab === 'pending' 
      ? constants.TRAVEL_STATUS.PENDING 
      : constants.TRAVEL_STATUS.VISITED;
    
    api.get(`/Travel/status/${status}`, { showLoading: false })
      .then(data => {
        const list = (data || [])
          .map(item => ({
            ...item,
            displayName: this._formatTravelDisplayName(item)
          }))
          .sort((a, b) => a.priority - b.priority);
        this.setData({ travelList: list });
      });
  },

  _formatTravelDisplayName(item) {
    if (item.type === 'Domestic' && item.domesticLocation) {
      const loc = item.domesticLocation;
      let name = [loc.province, loc.city].filter(Boolean).join('-');
      if (item.name) name += `(${item.name})`;
      return name;
    } else if (item.type === 'International' && item.country) {
      let name = item.country;
      if (item.name) name += `(${item.name})`;
      return name;
    }
    return item.name || '';
  },

  switchTravelTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.travelTab) {
      this.setData({ travelTab: tab, travelSwipeIndex: -1 }, () => {
        this.fetchTravelList();
      });
    }
  },

  showAddTravelForm() {
    this.setData({
      showTravelForm: true,
      travelFormTypeIndex: 0,
      travelFormName: '',
      travelFormPriority: 1,
      travelRegion: [],
      travelRegionDisplay: '',
      travelCountryIndex: 0
    });
  },

  cancelTravelForm() {
    this.setData({ showTravelForm: false });
  },

  onTravelTypeChange(e) {
    this.setData({
      travelFormTypeIndex: parseInt(e.detail.value),
      travelRegion: [],
      travelRegionDisplay: '',
      travelCountryIndex: 0
    });
  },

  onRegionChange(e) {
    const region = e.detail.value.filter(Boolean);
    this.setData({
      travelRegion: region,
      travelRegionDisplay: region.join('-')
    });
  },

  onCountryChange(e) {
    this.setData({ travelCountryIndex: parseInt(e.detail.value) });
  },

  onTravelNameInput(e) {
    this.setData({ travelFormName: e.detail.value });
  },

  onTravelPriorityChange(e) {
    this.setData({ travelFormPriority: e.detail.value });
  },

  submitTravelForm() {
    const { 
      travelFormTypeIndex, travelFormName, travelFormPriority, 
      travelRegion, countryList, travelCountryIndex 
    } = this.data;

    const destination = {
      name: travelFormName,
      type: travelFormTypeIndex === 0 ? 'Domestic' : 'International',
      priority: travelFormPriority,
      status: 'Pending'
    };

    if (travelFormTypeIndex === 0) {
      destination.domesticLocation = {
        province: travelRegion[0] || '',
        city: travelRegion[1] || ''
      };
    } else {
      destination.country = countryList[travelCountryIndex] || '';
    }

    api.post('/Travel', destination, { loadingText: '添加中...' })
      .then(() => {
        util.showSuccess('添加成功');
        this.setData({ showTravelForm: false });
        this.fetchTravelList();
      })
      .catch(() => util.showError('添加失败'));
  },

  onDeleteTravel(e) {
    const id = e.currentTarget.dataset.id;
    util.showConfirm('确认删除', '确定要删除该目的地吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/Travel/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchTravelList();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  onMarkVisited(e) {
    const id = e.currentTarget.dataset.id;
    util.showConfirm('确认标记', '确定要标记该目的地为已出行吗？')
      .then(confirmed => {
        if (confirmed) {
          api.post(`/Travel/${id}/visited`, {}, { loadingText: '标记中...' })
            .then(() => {
              util.showSuccess('标记成功');
              this.fetchTravelList();
            })
            .catch(() => util.showError('标记失败'));
        }
      });
  },

  // ==================== 触摸事件处理 ====================
  // 物品列表触摸
  onTouchStart(e) {
    this._handleTouchStart(e, 'swipeIndex');
  },

  onTouchMove(e) {
    this._handleTouchMove(e, 'swipeIndex');
  },

  onTouchEnd() {
    this.setData({ isVerticalScroll: false });
  },

  // 待购列表触摸
  onTouchStartToBuy(e) {
    this._handleTouchStart(e, 'toBuySwipeIndex');
  },

  onTouchMoveToBuy(e) {
    this._handleTouchMove(e, 'toBuySwipeIndex');
  },

  onTouchEndToBuy() {
    this.setData({ isVerticalScroll: false });
  },

  // 出行列表触摸
  onTouchStartTravel(e) {
    this._handleTouchStart(e, 'travelSwipeIndex');
  },

  onTouchMoveTravel(e) {
    this._handleTouchMove(e, 'travelSwipeIndex');
  },

  onTouchEndTravel() {
    this.setData({ isVerticalScroll: false });
  },

  // 通用触摸处理
  _handleTouchStart(e, swipeKey) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
      isVerticalScroll: false,
      [swipeKey]: -1
    });
  },

  _handleTouchMove(e, swipeKey) {
    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    const index = e.currentTarget.dataset.index;
    
    const deltaX = Math.abs(moveX - this.data.touchStartX);
    const deltaY = Math.abs(moveY - this.data.touchStartY);
    
    // 判断垂直滚动
    if (deltaY > deltaX && deltaY > 10) {
      this.setData({ isVerticalScroll: true });
      return;
    }
    
    if (this.data.isVerticalScroll) return;
    
    // 左滑显示操作按钮
    if (this.data.touchStartX - moveX > 50) {
      this.setData({ [swipeKey]: index });
    }
    // 右滑隐藏操作按钮
    if (moveX - this.data.touchStartX > 50) {
      this.setData({ [swipeKey]: -1 });
    }
  }
});
