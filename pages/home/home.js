/**
 * 首页逻辑
 * 生活状态仪表盘
 */
const api = require('../../utils/api');

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
    totalItems: '--',
    toBuyCount: '--',
    travelCount: '--',

    // 姨妈记录
    periodStats: null,

    // 猫猫体重
    catWeights: [],

    // 年度目标
    goalsPig: [],
    goalsDonkey: [],
    pigCompleted: 0,
    pigProgress: 0,
    donkeyCompleted: 0,
    donkeyProgress: 0,

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

  // 获取所有数据
  async fetchData() {
    this.setData({ loading: true });

    try {
      const currentYear = new Date().getFullYear();
      const [summaryResult, toBuyResult, travelResult, periodStats, catWeights, goalsResult] = await Promise.all([
        this._fetchSummary(),
        this._fetchToBuyData(),
        this._fetchTravelData(),
        this._fetchPeriodData(),
        this._fetchCatWeights(),
        this._fetchGoals(currentYear)
      ]);

      this.setData({
        loading: false,
        ...summaryResult,
        ...toBuyResult,
        ...travelResult,
        periodStats,
        catWeights,
        ...goalsResult
      });
    } catch (err) {
      console.error('获取数据失败', err);
      this.setData({ loading: false });
    }
  },

  // 获取物品摘要
  async _fetchSummary() {
    try {
      const summary = await api.getProductsSummary();
      const now = new Date();

      const expiredItems = (summary.expiredItems || []).map(item => {
        const diffDays = Math.abs(Math.ceil((new Date(item.bestBy) - now) / (1000 * 60 * 60 * 24)));
        return { ...item, emoji: this.getCategoryEmoji(item.category), daysText: diffDays + '天' };
      });

      const expiringSoonItems = (summary.expiringSoonItems || []).map(item => {
        const diffDays = Math.ceil((new Date(item.bestBy) - now) / (1000 * 60 * 60 * 24));
        return { ...item, emoji: this.getCategoryEmoji(item.category), daysText: diffDays === 0 ? '今天' : diffDays + '天' };
      });

      return { totalItems: summary.total, expiredItems, expiringSoonItems };
    } catch (err) {
      console.error('获取物品摘要失败', err);
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

  // 获取猫猫最新体重
  async _fetchCatWeights() {
    try {
      const records = await api.getWeightLatest();
      const now = new Date();
      return (records || []).map(r => {
        const recordDate = new Date(r.recordDate);
        const diffDays = Math.floor((now - recordDate) / (1000 * 60 * 60 * 24));
        let dateText = '今天';
        if (diffDays === 1) dateText = '昨天';
        else if (diffDays > 1) dateText = diffDays + '天前';
        return {
          personName: r.personName,
          weight: r.weight,
          dateText
        };
      });
    } catch (err) {
      console.error('获取猫猫体重失败', err);
      return [];
    }
  },

  // 获取年度目标
  async _fetchGoals(year) {
    try {
      const goals = await api.get(`/YearlyGoal?year=${year}`, { showLoading: false });
      const allGoals = (goals || []).map(g => ({
        ...g,
        subGoals: g.subGoals || [],
        completedSubGoalsCount: g.completedSubGoalsCount || 0,
        totalSubGoalsCount: g.totalSubGoalsCount || 0
      }));

      const goalsPig = allGoals.filter(g => g.owner === 'Pig');
      const goalsDonkey = allGoals.filter(g => g.owner === 'Donkey');
      const pigCompleted = goalsPig.filter(g => g.completed).length;
      const donkeyCompleted = goalsDonkey.filter(g => g.completed).length;

      return {
        goalsPig,
        goalsDonkey,
        pigCompleted,
        pigProgress: goalsPig.length ? Math.round(pigCompleted / goalsPig.length * 100) : 0,
        donkeyCompleted,
        donkeyProgress: goalsDonkey.length ? Math.round(donkeyCompleted / goalsDonkey.length * 100) : 0
      };
    } catch (err) {
      console.error('获取年度目标失败', err);
      return { goalsPig: [], goalsDonkey: [], pigCompleted: 0, pigProgress: 0, donkeyCompleted: 0, donkeyProgress: 0 };
    }
  },

  // 获取分类 emoji
  getCategoryEmoji(category) {
    const emojiMap = { 'Food': '🥖', 'CatFood': '🐱', 'Medicine': '💊' };
    return emojiMap[category] || '📦';
  },

  // ==================== 导航 ====================

  goToUpdateItem(e) {
    const { id, category } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/update/update?id=${id}&category=${category}` });
  },

  goToItems() {
    wx.switchTab({ url: '/pages/items/items' });
  },

  goToToBuyList() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'tobuy';
    wx.switchTab({ url: '/pages/items/items' });
  },

  goToTravel() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'travel';
    wx.switchTab({ url: '/pages/plan/plan' });
  },

  goToGoals() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'goals';
    wx.switchTab({ url: '/pages/plan/plan' });
  },

  goToPeriod() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'period';
    wx.switchTab({ url: '/pages/record/record' });
  },

  goToWeight() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'weight';
    wx.switchTab({ url: '/pages/record/record' });
  }
});
