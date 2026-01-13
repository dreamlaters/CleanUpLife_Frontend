/**
 * 首页逻辑处理
 * 管理物品列表、待购物品、出行目的地
 * 现代化UI设计版本
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    // 物品列表
    products: [],
    filteredProducts: [],
    currentFilter: 'all',
    swipeIndex: -1,
    
    // 统计数据
    expiringSoonCount: 0,
    expiredCount: 0,
    
    // 待购物品
    toBuyProducts: [],
    toBuyPending: [],      // 未完成的待购
    toBuyCompleted: [],    // 已完成的待购
    showCompletedToBuy: false, // 是否展开已完成列表
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
    
    // 操作菜单
    showActionSheet: false,
    actionSheetTitle: '',
    actionSheetType: '',
    actionSheetId: '',
    actionSheetCategory: '',
    
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
        const now = new Date();
        let expiringSoonCount = 0;
        let expiredCount = 0;
        
        const products = (data || []).map(item => {
          const bestByDate = new Date(item.bestBy);
          const diffDays = Math.ceil((bestByDate - now) / (1000 * 60 * 60 * 24));
          
          let dateClass = 'date-normal';
          if (diffDays < 0) {
            dateClass = 'date-expired';
            expiredCount++;
          } else if (diffDays <= 7) {
            dateClass = 'date-soon';
            expiringSoonCount++;
          }
          
          return {
            ...item,
            bestByFormatted: util.formatDate(item.bestBy),
            dateClass: dateClass,
            emoji: constants.CATEGORY_EMOJI[item.category] || '📦'
          };
        });
        
        this.setData({ 
          products,
          filteredProducts: products,
          expiringSoonCount,
          expiredCount
        });
      })
      .catch(() => {
        util.showError('数据加载失败');
      });
  },

  // 筛选切换
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    const { products } = this.data;
    
    let filteredProducts = products;
    if (filter !== 'all') {
      filteredProducts = products.filter(item => item.category === filter);
    }
    
    this.setData({ 
      currentFilter: filter,
      filteredProducts 
    });
  },

  // 显示物品操作菜单
  showItemActions(e) {
    const { id, category } = e.currentTarget.dataset;
    const item = this.data.products.find(p => p.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.name : '操作',
      actionSheetType: 'product',
      actionSheetId: id,
      actionSheetCategory: category || 'Product'
    });
  },

  // 显示待购操作菜单
  showToBuyActions(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.toBuyProducts.find(p => p.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.name : '操作',
      actionSheetType: 'tobuy',
      actionSheetId: id
    });
  },

  // 显示出行操作菜单
  showTravelActions(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.travelList.find(p => p.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.displayName : '操作',
      actionSheetType: 'travel',
      actionSheetId: id
    });
  },

  // 隐藏操作菜单
  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  // 操作菜单 - 编辑
  onActionEdit() {
    const { actionSheetType, actionSheetId, actionSheetCategory } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'product') {
        wx.navigateTo({
          url: `/pages/update/update?id=${actionSheetId}&category=${actionSheetCategory}`
        });
      } else if (actionSheetType === 'tobuy') {
        wx.navigateTo({ url: `/pages/tobuy/update?id=${actionSheetId}` });
      }
    }, 200);
  },

  // 操作菜单 - 删除
  onActionDelete() {
    const { actionSheetType, actionSheetId } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'product') {
        this._deleteProduct(actionSheetId);
      } else if (actionSheetType === 'tobuy') {
        this._deleteToBuy(actionSheetId);
      } else if (actionSheetType === 'travel') {
        this._deleteTravel(actionSheetId);
      }
    }, 200);
  },

  _deleteProduct(id) {
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

  // 删除物品 (兼容旧调用)
  onDelete(e) {
    this._deleteProduct(e.currentTarget.dataset.id);
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
    const { sortField, sortOrder, filteredProducts } = this.data;
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    
    const sortedProducts = [...filteredProducts].sort((a, b) => {
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
      filteredProducts: sortedProducts,
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
            name: item.name ?? item.Name ?? '',
            completed: item.completed ?? item.Completed ?? false
          }))
          .sort((a, b) => a.priority - b.priority);
        
        // 分组：未完成和已完成
        const toBuyPending = list.filter(item => !item.completed);
        const toBuyCompleted = list.filter(item => item.completed);
        
        this.setData({ 
          toBuyProducts: list,
          toBuyPending,
          toBuyCompleted
        });
      });
  },

  // 切换已完成列表展开/折叠
  toggleCompletedToBuyList() {
    this.setData({ showCompletedToBuy: !this.data.showCompletedToBuy });
  },

  // 清除所有已完成的待购
  clearCompletedToBuy() {
    if (!this.data.toBuyCompleted.length) return;
    
    util.showConfirm('清除已完成', `确定要清除 ${this.data.toBuyCompleted.length} 个已完成的待购物品吗？`)
      .then(confirmed => {
        if (confirmed) {
          api.del('/ToBuy/completed', { loadingText: '清除中...' })
            .then(() => {
              util.showSuccess('清除成功');
              this.setData({ showCompletedToBuy: false });
              this.fetchToBuyProducts();
            })
            .catch(() => util.showError('清除失败'));
        }
      });
  },

  goToAddToBuy() {
    wx.navigateTo({ url: '/pages/tobuy/add' });
  },

  _deleteToBuy(id) {
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

  onDeleteToBuy(e) {
    this._deleteToBuy(e.currentTarget.dataset.id);
  },

  onUpdateToBuy(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/tobuy/update?id=${id}` });
  },

  // 切换待购完成状态
  toggleToBuyComplete(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.toBuyProducts.find(p => p.id === id);
    if (!item) return;
    
    // 先乐观更新UI
    const newList = this.data.toBuyProducts.map(p => {
      if (p.id === id) {
        return { ...p, completed: !p.completed };
      }
      return p;
    });
    const toBuyPending = newList.filter(item => !item.completed);
    const toBuyCompleted = newList.filter(item => item.completed);
    this.setData({ toBuyProducts: newList, toBuyPending, toBuyCompleted });
    
    // 调用API持久化状态
    api.request({
      url: `/ToBuy/${id}/toggle-completed`,
      method: 'PATCH',
      showLoading: false
    }).catch(() => {
      // 如果API调用失败，恢复原状态
      const revertList = this.data.toBuyProducts.map(p => {
        if (p.id === id) {
          return { ...p, completed: !p.completed };
        }
        return p;
      });
      const revertPending = revertList.filter(item => !item.completed);
      const revertCompleted = revertList.filter(item => item.completed);
      this.setData({ toBuyProducts: revertList, toBuyPending: revertPending, toBuyCompleted: revertCompleted });
      wx.showToast({ title: '操作失败', icon: 'error' });
    });
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

  _deleteTravel(id) {
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

  onDeleteTravel(e) {
    this._deleteTravel(e.currentTarget.dataset.id);
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
