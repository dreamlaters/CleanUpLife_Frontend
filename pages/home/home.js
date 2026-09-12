/**
 * 首页逻辑
 * 生活状态仪表盘
 */
const api = require('../../utils/api');

const HOME_SECTIONS = ['products', 'toBuy', 'goals', 'weights', 'period', 'play', 'savings'];
const ATTENTION_SECTIONS = ['products', 'play', 'savings'];
const SECTION_LABELS = {
  products: '物品到期提醒',
  play: '猫猫陪玩状态',
  savings: '退休存钱盘点'
};
const SECTION_ERROR_MESSAGES = {
  timeout: '模块加载超时，请重试',
  dependency_unavailable: '模块暂不可用，请重试'
};
const EMPTY_SECTION_DATA = {
  products: { expiredItems: [], expiringSoonItems: [] },
  toBuy: { toBuyCount: null },
  goals: {
    pigTotal: null,
    donkeyTotal: null,
    pigCompleted: null,
    pigProgress: null,
    donkeyCompleted: null,
    donkeyProgress: null
  },
  weights: { catWeights: [] },
  period: { periodStats: null },
  play: { playStatus: null },
  savings: { savingsSummary: null }
};

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isCount = value => Number.isInteger(value) && value >= 0;
const isDate = value => typeof value === 'string' && Number.isFinite(new Date(value).getTime());
const isNullableNumber = value => value === null || Number.isFinite(value);
const isGoalCount = value => isObject(value) && isCount(value.total) &&
  isCount(value.completed) && value.completed <= value.total;
const isProduct = value => isObject(value) && typeof value.id === 'string' &&
  typeof value.name === 'string' && typeof value.category === 'string' && isDate(value.bestBy);

// 不把缺失、格式错误的响应当作空列表或零值，否则会误报“没有提醒”。
const SECTION_VALIDATORS = {
  products: value => isObject(value) && Array.isArray(value.expiredItems) &&
    value.expiredItems.every(isProduct) && Array.isArray(value.expiringSoonItems) &&
    value.expiringSoonItems.every(isProduct),
  toBuy: value => isObject(value) && isCount(value.count),
  goals: value => isObject(value) && isGoalCount(value.pig) && isGoalCount(value.donkey),
  weights: value => Array.isArray(value) && value.every(record => isObject(record) &&
    typeof record.personName === 'string' && Number.isFinite(record.weight) && isDate(record.recordDate)),
  period: value => isObject(value) && ['none', 'in-period', 'waiting'].includes(value.status) &&
    isNullableNumber(value.averageCycleDays) &&
    (value.daysUntilNextPeriod === null || Number.isInteger(value.daysUntilNextPeriod)),
  play: value => isObject(value) && typeof value.ongoing === 'boolean',
  savings: value => isObject(value) && typeof value.hasSetup === 'boolean' &&
    Number.isFinite(value.netAssets) && Number.isFinite(value.targetAmount) &&
    Number.isFinite(value.progressPercent) && Number.isFinite(value.remainingToGoal) &&
    isObject(value.currentMonthStatus) && typeof value.currentMonthStatus.month === 'string' &&
    ['pigConfirmed', 'donkeyConfirmed', 'mortgageConfirmed', 'isProvisional']
      .every(key => typeof value.currentMonthStatus[key] === 'boolean') &&
    Array.isArray(value.currentMonthStatus.missingOwners) &&
    value.currentMonthStatus.missingOwners.every(owner => typeof owner === 'string')
};

const isDashboardEnvelope = value => isObject(value) && typeof value.requestId === 'string' &&
  typeof value.partial === 'boolean' && isObject(value.sections);

Page({
  data: {
    // 导航栏高度
    statusBarHeight: 20,
    navbarHeight: 88,

    // 问候语
    greeting: '早上好',
    dateText: '',
    reminderPending: true,

    ...EMPTY_SECTION_DATA.products,
    ...EMPTY_SECTION_DATA.toBuy,
    ...EMPTY_SECTION_DATA.goals,
    ...EMPTY_SECTION_DATA.weights,
    ...EMPTY_SECTION_DATA.period,
    ...EMPTY_SECTION_DATA.play,
    ...EMPTY_SECTION_DATA.savings,
    attentionCount: 0,
    attentionComplete: false,
    attentionPendingNames: '',
    allClear: false,
    sectionStates: HOME_SECTIONS.reduce((states, section) => {
      states[section] = { status: 'idle', loading: false, error: '' };
      return states;
    }, {}),
    failedSections: [],
    dashboardError: '',
    requestId: '',

    // 加载状态
    loading: true,
    refreshing: false
  },

  onLoad() {
    this.initNavbar();
    this.updateGreeting();
  },

  onShow() {
    this.setData({ reminderPending: !wx.getStorageSync('reminders:authorized') });
    return this.fetchData();
  },

  onUnload() {
    this._unloaded = true;
    this._queuedRefresh = null;
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

  fetchData() {
    if (this._unloaded) return Promise.resolve();
    this._refreshVersion = (this._refreshVersion || 0) + 1;
    this._queuedRefresh = { sections: null, version: this._refreshVersion };
    return this._startDashboardRefresh();
  },

  retryFailedSections(event) {
    if (this._unloaded || this._refreshPromise) return this._refreshPromise || Promise.resolve();
    const selected = event?.currentTarget?.dataset?.section;
    const sections = HOME_SECTIONS.filter(section =>
      this.data.sectionStates[section].status === 'error' && (!selected || section === selected));
    if (!sections.length) return Promise.resolve();
    this._refreshVersion = (this._refreshVersion || 0) + 1;
    this._queuedRefresh = { sections, version: this._refreshVersion };
    return this._startDashboardRefresh();
  },

  _startDashboardRefresh() {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = this._drainDashboardRefreshes().finally(() => {
      this._refreshPromise = null;
      if (this._queuedRefresh && !this._unloaded) {
        return this._startDashboardRefresh();
      }
    });
    return this._refreshPromise;
  },

  async _drainDashboardRefreshes() {
    try {
      while (this._queuedRefresh && !this._unloaded) {
        const refresh = this._queuedRefresh;
        this._queuedRefresh = null;
        const requested = refresh.sections || HOME_SECTIONS;
        const sectionStates = { ...this.data.sectionStates };
        requested.forEach(section => {
          sectionStates[section] = { ...sectionStates[section], loading: true };
        });
        this._updateDashboardState({
          loading: !this._hasLoaded,
          refreshing: Boolean(this._hasLoaded)
        }, sectionStates);

        let response;
        let failure;
        try {
          response = await api.getHomeDashboard(new Date().getFullYear(), refresh.sections);
        } catch (error) {
          failure = error;
        }

        if (this._unloaded) break;
        // 返回写入页面后触发的刷新不能被吞掉；串行补发最新刷新，不渲染旧请求的结果。
        if (refresh.version !== this._refreshVersion) continue;

        if (failure) {
          if (failure.statusCode === 503 && isDashboardEnvelope(failure.data) &&
              requested.every(section => failure.data.sections[section]?.status === 'error')) {
            this._applyDashboardEnvelope(failure.data, requested);
          } else {
            const message = failure.errMsg
              ? '网络连接失败，请检查网络后重试'
              : '首页加载失败，请稍后重试';
            this._applyDashboardFailure(message, requested);
          }
        } else if (isDashboardEnvelope(response)) {
          this._applyDashboardEnvelope(response, requested);
        } else {
          this._applyDashboardFailure('首页返回的数据不完整，请重试', requested);
        }
        this._hasLoaded = true;
      }
    } finally {
      if (!this._unloaded) {
        this.setData({ loading: false, refreshing: false });
      }
    }
  },

  _applyDashboardEnvelope(envelope, requested) {
    const sectionStates = { ...this.data.sectionStates };
    const patch = { dashboardError: '', requestId: envelope.requestId };
    requested.forEach(section => {
      const result = envelope.sections[section];
      if (result?.status === 'ok' && result.error === null && SECTION_VALIDATORS[section](result.data)) {
        sectionStates[section] = { status: 'ok', loading: false, error: '' };
        Object.assign(patch, this._formatSection(section, result.data));
      } else {
        const expectedFailure = result?.status === 'error' && result.data === null &&
          isObject(result.error) && ['timeout', 'dependency_unavailable'].includes(result.error.code) &&
          typeof result.error.message === 'string' && result.error.message.length > 0 &&
          result.error.retryable === true;
        sectionStates[section] = {
          status: 'error',
          loading: false,
          error: expectedFailure ? SECTION_ERROR_MESSAGES[result.error.code] : '返回数据不完整，请重试'
        };
        Object.assign(patch, EMPTY_SECTION_DATA[section]);
      }
    });
    this._updateDashboardState(patch, sectionStates);
  },

  _applyDashboardFailure(message, requested) {
    const sectionStates = { ...this.data.sectionStates };
    const patch = { dashboardError: message, requestId: '' };
    requested.forEach(section => {
      sectionStates[section] = { status: 'error', loading: false, error: message };
      Object.assign(patch, EMPTY_SECTION_DATA[section]);
    });
    this._updateDashboardState(patch, sectionStates);
  },

  _updateDashboardState(patch, sectionStates) {
    const next = { ...this.data, ...patch };
    const available = section => sectionStates[section].status === 'ok';
    const attentionCount =
      (available('products') ? next.expiredItems.length + next.expiringSoonItems.length : 0) +
      (available('play') && next.playStatus.ongoing ? 1 : 0) +
      (available('savings') && next.savingsSummary.hasSetup && next.savingsSummary.isProvisional ? 1 : 0);
    const pending = ATTENTION_SECTIONS.filter(section => !available(section) || sectionStates[section].loading);
    this.setData({
      ...patch,
      sectionStates,
      failedSections: HOME_SECTIONS.filter(section => sectionStates[section].status === 'error'),
      attentionCount,
      attentionComplete: pending.length === 0,
      attentionPendingNames: pending.map(section => SECTION_LABELS[section]).join('、'),
      allClear: pending.length === 0 && attentionCount === 0
    });
  },

  _formatSection(section, value) {
    const now = new Date();
    switch (section) {
      case 'products':
        return {
          expiredItems: value.expiredItems.map(item => {
            const diffDays = Math.abs(Math.ceil((new Date(item.bestBy) - now) / (1000 * 60 * 60 * 24)));
            return { ...item, emoji: this.getCategoryEmoji(item.category), daysText: diffDays + '天' };
          }),
          expiringSoonItems: value.expiringSoonItems.map(item => {
            const diffDays = Math.ceil((new Date(item.bestBy) - now) / (1000 * 60 * 60 * 24));
            return { ...item, emoji: this.getCategoryEmoji(item.category), daysText: diffDays === 0 ? '今天' : diffDays + '天' };
          })
        };
      case 'toBuy':
        return { toBuyCount: value.count };
      case 'goals':
        return {
          pigTotal: value.pig.total,
          donkeyTotal: value.donkey.total,
          pigCompleted: value.pig.completed,
          donkeyCompleted: value.donkey.completed,
          pigProgress: value.pig.total ? Math.round(value.pig.completed / value.pig.total * 100) : 0,
          donkeyProgress: value.donkey.total ? Math.round(value.donkey.completed / value.donkey.total * 100) : 0
        };
      case 'weights':
        return {
          catWeights: value.map(record => {
            const diffDays = Math.floor((now - new Date(record.recordDate)) / (1000 * 60 * 60 * 24));
            let dateText = '今天';
            if (diffDays === 1) dateText = '昨天';
            else if (diffDays > 1) dateText = diffDays + '天前';
            return { personName: record.personName, weight: record.weight, dateText };
          })
        };
      case 'period':
        return {
          periodStats: {
            ...value,
            averageCycleDays: value.averageCycleDays ? Math.round(value.averageCycleDays) : value.averageCycleDays
          }
        };
      case 'play':
        return { playStatus: value };
      case 'savings':
        return { savingsSummary: this._formatSavings(value) };
    }
  },

  _formatSavings(dashboard) {
    const status = dashboard.currentMonthStatus;
    const progress = Math.max(0, dashboard.progressPercent);
    let checkInText = '本月还未盘点';
    if (status.pigConfirmed && status.donkeyConfirmed) {
      checkInText = '本月双人盘点已完成';
    } else if (status.pigConfirmed) {
      checkInText = '猪猪已更新，等待毛驴';
    } else if (status.donkeyConfirmed) {
      checkInText = '毛驴已更新，等待猪猪';
    }

    return {
      hasSetup: dashboard.hasSetup,
      netAssets: dashboard.netAssets,
      netAssetsText: this.formatCompactCurrency(dashboard.netAssets),
      targetAmount: dashboard.targetAmount,
      targetText: this.formatCompactCurrency(dashboard.targetAmount),
      progress: Math.round(progress * 10) / 10,
      progressWidth: Math.min(100, progress),
      remainingText: this.formatCompactCurrency(Math.max(0, dashboard.remainingToGoal)),
      checkInText,
      isProvisional: status.isProvisional
    };
  },

  formatCompactCurrency(value) {
    const amount = Number(value) || 0;
    const sign = amount < 0 ? '-' : '';
    const absolute = Math.abs(amount);
    if (absolute >= 10000) {
      const compact = (absolute / 10000).toFixed(1).replace(/\.0$/, '');
      return `${sign}¥${compact}万`;
    }
    return `${sign}¥${absolute.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
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

  goToAddToBuy() {
    const app = getApp();
    app.globalData = app.globalData || {};
    app.globalData.targetTab = 'tobuy';
    app.globalData.targetAction = 'addToBuy';
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

  goToSavings() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetTab = 'savings';
    wx.switchTab({ url: '/pages/plan/plan' });
  },

  goToPeriod() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetHealthTab = 'period';
    wx.switchTab({ url: '/pages/health/health' });
  },

  goToWeight() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetCatTab = 'weight';
    wx.switchTab({ url: '/pages/cat/cat' });
  },

  goToPlay() {
    getApp().globalData = getApp().globalData || {};
    getApp().globalData.targetCatTab = 'play';
    wx.switchTab({ url: '/pages/cat/cat' });
  }
});
