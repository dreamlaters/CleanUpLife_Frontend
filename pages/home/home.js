/**
 * 首页逻辑
 * 显示过期提醒 + 快捷入口
 */
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    // 导航栏高度
    statusBarHeight: 20,
    navbarHeight: 88,
    
    // 问候语
    greeting: '早上好',
    dateText: '',
    
    // 过期物品
    expiredItems: [],
    expiringSoonItems: [],
    
    // 统计数据
    totalItems: 0,
    toBuyCount: 0,
    travelCount: 0,
    
    // 姨妈记录
    periodStats: null,
    
    // 加载状态
    loading: false
  },

  onLoad() {
    this.initNavbar();
    this.updateGreeting();
  },

  onShow() {
    this.fetchData();
  },

  // 初始化导航栏高度
  initNavbar() {
    const app = getApp();
    const systemInfo = app.getSystemInfo();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navbarHeight = statusBarHeight + 44 + 10;
    this.setData({ statusBarHeight, navbarHeight });
  },

  // 更新问候语和日期
  updateGreeting() {
    const hour = new Date().getHours();
    let greeting = '早上好';
    if (hour >= 12 && hour < 14) {
      greeting = '中午好';
    } else if (hour >= 14 && hour < 18) {
      greeting = '下午好';
    } else if (hour >= 18 || hour < 6) {
      greeting = '晚上好';
    }
    
    const now = new Date();
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const dateText = `${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
    
    this.setData({ greeting, dateText });
  },

  // 获取所有数据 - 优化：合并 setData 减少渲染次数
  async fetchData() {
    this.setData({ loading: true });
    
    try {
      // 并行获取数据
      const [productsResult, toBuyResult, travelResult, periodStats] = await Promise.all([
        this._fetchProductsData(),
        this._fetchToBuyData(),
        this._fetchTravelData(),
        this._fetchPeriodData()
      ]);
      
      // 合并所有数据，一次性 setData
      this.setData({
        loading: false,
        ...productsResult,
        ...toBuyResult,
        ...travelResult,
        periodStats
      });
    } catch (err) {
      console.error('获取数据失败', err);
      this.setData({ loading: false });
    }
  },

  // 获取物品数据（不 setData，返回处理后的数据）
  async _fetchProductsData() {
    try {
      const res = await api.getProductList();
      const products = res.data || [];
      
      const now = new Date();
      const expiredItems = [];
      const expiringSoonItems = [];
      
      for (let i = 0; i < products.length; i++) {
        const item = products[i];
        const bestByDate = new Date(item.bestBy);
        const diffDays = Math.ceil((bestByDate - now) / (1000 * 60 * 60 * 24));
        
        item.emoji = this.getCategoryEmoji(item.category);
        
        if (diffDays < 0) {
          item.daysText = Math.abs(diffDays) + '天';
          expiredItems.push(item);
        } else if (diffDays <= 30) {
          item.daysText = diffDays === 0 ? '今天' : diffDays + '天';
          expiringSoonItems.push(item);
        }
      }
      
      // 排序
      expiredItems.sort((a, b) => new Date(a.bestBy) - new Date(b.bestBy));
      expiringSoonItems.sort((a, b) => new Date(a.bestBy) - new Date(b.bestBy));
      
      return {
        totalItems: products.length,
        expiredItems,
        expiringSoonItems
      };
    } catch (err) {
      console.error('获取物品列表失败', err);
      return { totalItems: 0, expiredItems: [], expiringSoonItems: [] };
    }
  },

  // 获取待购数据
  async _fetchToBuyData() {
    try {
      const res = await api.getToBuyList();
      const list = res.data || [];
      return { toBuyCount: list.filter(item => !item.completed).length };
    } catch (err) {
      console.error('获取待购列表失败', err);
      return { toBuyCount: 0 };
    }
  },

  // 获取出行数据
  async _fetchTravelData() {
    try {
      const res = await api.getPendingTravelList();
      return { travelCount: (res.data || []).length };
    } catch (err) {
      console.error('获取出行列表失败', err);
      return { travelCount: 0 };
    }
  },

  // 获取姨妈统计
  async _fetchPeriodData() {
    try {
      const stats = await api.getPeriodStats();
      if (stats && stats.averageCycleDays) {
        stats.averageCycleDays = Math.round(stats.averageCycleDays);
      }
      return stats;
    } catch (err) {
      console.error('获取姨妈统计失败', err);
      return null;
    }
  },

  // 获取分类 emoji
  getCategoryEmoji(category) {
    const emojiMap = {
      'Food': '🥖',
      'CatFood': '🐱',
      'Medicine': '💊'
    };
    return emojiMap[category] || '📦';
  },

  // ==================== 导航 ====================
  
  // 跳转到物品详情
  goToUpdateItem(e) {
    const { id, category } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/update/update?id=${id}&category=${category}`
    });
  },

  // 跳转到添加物品
  goToAddItem() {
    wx.navigateTo({
      url: '/pages/add/add'
    });
  },

  // 跳转到物品 Tab
  goToItems() {
    wx.switchTab({
      url: '/pages/items/items'
    });
  },

  // 跳转到待购清单
  goToToBuyList() {
    // 先设置全局变量，然后跳转
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'tobuy';
    wx.switchTab({
      url: '/pages/items/items'
    });
  },

  // 跳转到出行计划
  goToTravel() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'travel';
    wx.switchTab({
      url: '/pages/plan/plan'
    });
  },

  // 跳转到年度目标
  goToGoals() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'goals';
    wx.switchTab({
      url: '/pages/plan/plan'
    });
  },

  // 跳转到姨妈记录
  goToPeriod() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'period';
    wx.switchTab({
      url: '/pages/record/record'
    });
  }
});
