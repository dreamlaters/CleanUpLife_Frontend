/**
 * 物品管理页面逻辑
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    // 导航栏
    statusBarHeight: 20,
    navbarHeight: 88,
    
    // Tab切换
    currentTab: 'items',
    
    // 物品列表
    products: [],
    filteredProducts: [],
    currentFilter: 'all',
    expiringSoonCount: 0,
    expiredCount: 0,
    loadingProducts: false,
    
    // 待购物品
    toBuyProducts: [],
    toBuyPending: [],
    toBuyCompleted: [],
    showCompleted: false,
    loadingToBuy: false,
    
    // 操作菜单
    showActionSheet: false,
    actionSheetTitle: '',
    actionSheetType: '',
    actionSheetId: '',
    actionSheetCategory: ''
  },

  onLoad(options) {
    this.initNavbar();
    if (options.tab) {
      this.setData({ currentTab: options.tab });
    }
  },

  onShow() {
    // 检查是否有从首页跳转的 tab 指定
    const app = getApp();
    if (app.globalData && app.globalData.targetTab === 'tobuy') {
      this.setData({ currentTab: 'tobuy' });
      app.globalData.targetTab = null; // 清除
    }
    this.fetchProducts();
    this.fetchToBuyProducts();
  },

  // 初始化导航栏高度
  initNavbar() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      const statusBarHeight = systemInfo.statusBarHeight || 20;
      const navbarHeight = statusBarHeight + 44 + 10;
      this.setData({ statusBarHeight, navbarHeight });
    } catch (e) {
      console.error('获取系统信息失败', e);
    }
  },

  // Tab切换
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // ==================== 物品管理 ====================
  fetchProducts() {
    this.setData({ loadingProducts: true });
    api.get('/Products', { showLoading: false })
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
          } else if (diffDays <= 30) {
            dateClass = 'date-soon';
            expiringSoonCount++;
          }
          
          return {
            ...item,
            bestByFormatted: util.formatDate(item.bestBy),
            dateClass,
            emoji: constants.CATEGORY_EMOJI[item.category] || '📦'
          };
        });
        
        // 按过期时间排序
        products.sort((a, b) => new Date(a.bestBy) - new Date(b.bestBy));
        
        this.setData({ 
          products,
          filteredProducts: this.filterProducts(products, this.data.currentFilter),
          expiringSoonCount,
          expiredCount,
          loadingProducts: false
        });
      })
      .catch(() => {
        this.setData({ loadingProducts: false });
        util.showError('加载失败');
      });
  },

  filterProducts(products, filter) {
    if (filter === 'all') return products;
    return products.filter(item => item.category === filter);
  },

  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ 
      currentFilter: filter,
      filteredProducts: this.filterProducts(this.data.products, filter)
    });
  },

  onUpdate(e) {
    const { id, category = 'Product' } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/update/update?id=${id}&category=${category}`
    });
  },

  goToAddItem() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

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

  // ==================== 待购物品 ====================
  fetchToBuyProducts() {
    this.setData({ loadingToBuy: true });
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
        
        this.setData({ 
          toBuyProducts: list,
          toBuyPending: list.filter(item => !item.completed),
          toBuyCompleted: list.filter(item => item.completed),
          loadingToBuy: false
        });
      })
      .catch(() => {
        this.setData({ loadingToBuy: false });
      });
  },

  toggleCompletedList() {
    this.setData({ showCompleted: !this.data.showCompleted });
  },

  toggleToBuyComplete(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.toBuyProducts.find(p => p.id === id);
    if (!item) return;
    
    const newCompleted = !item.completed;
    
    // 乐观更新
    const newList = this.data.toBuyProducts.map(p => 
      p.id === id ? { ...p, completed: newCompleted } : p
    );
    this.setData({
      toBuyProducts: newList,
      toBuyPending: newList.filter(item => !item.completed),
      toBuyCompleted: newList.filter(item => item.completed)
    });
    
    // 发送请求
    api.put(`/ToBuy/${id}`, {
      name: item.name,
      priority: item.priority,
      completed: newCompleted
    }, { showLoading: false }).catch(() => {
      this.fetchToBuyProducts(); // 失败时重新获取
    });
  },

  clearCompletedToBuy() {
    if (!this.data.toBuyCompleted.length) return;
    
    util.showConfirm('清除已完成', `确定要清除 ${this.data.toBuyCompleted.length} 个已完成的待购物品吗？`)
      .then(confirmed => {
        if (confirmed) {
          api.del('/ToBuy/completed', { loadingText: '清除中...' })
            .then(() => {
              util.showSuccess('清除成功');
              this.setData({ showCompleted: false });
              this.fetchToBuyProducts();
            })
            .catch(() => util.showError('清除失败'));
        }
      });
  },

  onUpdateToBuy(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/tobuy/update?id=${id}` });
  },

  goToAddToBuy() {
    wx.navigateTo({ url: '/pages/tobuy/add' });
  },

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

  // ==================== 操作菜单 ====================
  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

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

  onActionDelete() {
    const { actionSheetType, actionSheetId } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'product') {
        this.deleteProduct(actionSheetId);
      } else if (actionSheetType === 'tobuy') {
        this.deleteToBuy(actionSheetId);
      }
    }, 200);
  },

  deleteProduct(id) {
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

  deleteToBuy(id) {
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
  }
});
