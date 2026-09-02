const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    statusBarHeight: 20,
    navbarHeight: 88,

    currentTab: 'period',
    healthTabs: [
      { value: 'period', label: '经期', icon: 'flower' },
      { value: 'checkup', label: '体检', icon: 'health' }
    ],

    currentYear: 2026,
    currentMonth: 1,
    calendarDays: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],

    periodRecords: [],
    periodStats: null,
    latestPeriodRecord: null,
    periodDays: 1,
    loadingPeriod: false,
    showStartModal: false,
    showEndModal: false,
    startDate: '',
    endDate: '',
    notes: '',
    selectedPeriodRecord: null,
    showPeriodEditModal: false,
    editStartDate: '',
    editEndDate: '',
    editNotes: '',

    checkupRecords: [],
    checkupOwner: 'Pig',
    checkupOwners: constants.CHECKUP_OWNERS,
    checkupOwnerConfig: constants.CHECKUP_OWNER_CONFIG,
    loadingCheckup: false,
    showCheckupActionSheet: false,
    checkupActionSheetId: ''
  },

  onLoad(options) {
    this.initNavbar();
    const now = new Date();
    const rememberedTab = wx.getStorageSync('health:lastTab');
    const initialTab = options.tab === 'checkup' || options.tab === 'period'
      ? options.tab
      : (rememberedTab === 'checkup' ? 'checkup' : 'period');

    this.setData({
      currentTab: initialTab,
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      startDate: util.formatDate(now),
      endDate: util.formatDate(now)
    });
  },

  onShow() {
    const app = getApp();
    const targetTab = app.globalData && app.globalData.targetHealthTab;

    if (targetTab === 'period' || targetTab === 'checkup') {
      app.globalData.targetHealthTab = null;
      this.setData({ currentTab: targetTab });
      wx.setStorageSync('health:lastTab', targetTab);
    } else if (app.globalData && app.globalData.targetHealthTab) {
      app.globalData.targetHealthTab = null;
    }

    this.fetchPeriodData();
    this.fetchCheckupRecords();
  },

  initNavbar() {
    const app = getApp();
    const systemInfo = app.getSystemInfo();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navbarHeight = statusBarHeight + 44 + 10;
    this.setData({ statusBarHeight, navbarHeight });
  },

  stopPropagation() {},

  switchTab(e) {
    const tab = e.detail && e.detail.value;
    if (tab !== 'period' && tab !== 'checkup') return;

    this.setData({ currentTab: tab });
    wx.setStorageSync('health:lastTab', tab);
    if (tab === 'period') {
      this.fetchPeriodData();
    } else {
      this.fetchCheckupRecords();
    }
  },

  async fetchPeriodData() {
    this.setData({ loadingPeriod: true });

    try {
      const [recordsRes, stats] = await Promise.all([
        api.getPeriodList(),
        api.getPeriodStats()
      ]);

      const records = (recordsRes.data || []).map(record => ({
        ...record,
        startDateDisplay: record.startDate ? record.startDate.substring(0, 10) : '',
        endDateDisplay: record.endDate ? record.endDate.substring(0, 10) : ''
      }));
      const latestPeriodRecord = records.length > 0 ? records[0] : null;

      let periodDays = 1;
      if (latestPeriodRecord && latestPeriodRecord.startDate && !latestPeriodRecord.endDate) {
        const startParts = latestPeriodRecord.startDate.substring(0, 10).split('-');
        const startDate = new Date(
          parseInt(startParts[0], 10),
          parseInt(startParts[1], 10) - 1,
          parseInt(startParts[2], 10)
        );
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        periodDays = Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) + 1;
      }

      if (stats && stats.averageCycleDays) {
        stats.averageCycleDays = Math.round(stats.averageCycleDays);
      }

      this.setData({
        periodRecords: records,
        periodStats: stats,
        latestPeriodRecord,
        periodDays,
        loadingPeriod: false
      });
      this.generateCalendar();
    } catch (err) {
      console.error('获取姨妈数据失败', err);
      this.setData({ loadingPeriod: false });
    }
  },

  generateCalendar() {
    const { currentYear, currentMonth, periodRecords, periodStats } = this.data;
    const firstDayWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    const days = [];

    for (let i = firstDayWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        isPeriod: false,
        isPredicted: false
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dateObj = new Date(currentYear, currentMonth - 1, i);
      let isPeriod = false;
      let isPredicted = false;
      let isStart = false;
      let isEnd = false;

      for (const record of periodRecords) {
        const startDate = new Date(record.startDate);
        const endDate = record.endDate ? new Date(record.endDate) : null;

        if (this.isSameDay(dateObj, startDate)) {
          isPeriod = true;
          isStart = true;
        }

        if (endDate && this.isSameDay(dateObj, endDate)) {
          isPeriod = true;
          isEnd = true;
        }

        if (endDate) {
          if (dateObj >= startDate && dateObj <= endDate) {
            isPeriod = true;
          }
        } else {
          const averagePeriodDays = (periodStats && periodStats.averagePeriodDays) || 6;
          const predictedEnd = new Date(startDate);
          predictedEnd.setDate(predictedEnd.getDate() + averagePeriodDays - 1);

          if (dateObj >= startDate && dateObj <= predictedEnd) {
            isPeriod = true;
            if (dateObj > startDate && !this.isSameDay(dateObj, startDate)) {
              isPredicted = true;
            }
          }
        }
      }

      if (!isPeriod && periodStats && periodStats.predictedPeriods) {
        for (const predictedPeriod of periodStats.predictedPeriods) {
          const predictedStart = new Date(predictedPeriod.startDate);
          const predictedEnd = new Date(predictedPeriod.endDate);
          if (dateObj >= predictedStart && dateObj <= predictedEnd) {
            isPredicted = true;
            break;
          }
        }
      }

      days.push({
        day: i,
        date: dateStr,
        isCurrentMonth: true,
        isPeriod,
        isPredicted,
        isStart,
        isEnd,
        isToday: this.isSameDay(dateObj, new Date())
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isPeriod: false,
        isPredicted: false
      });
    }

    this.setData({ calendarDays: days });
  },

  isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear()
      && date1.getMonth() === date2.getMonth()
      && date1.getDate() === date2.getDate();
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth }, () => this.generateCalendar());
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth }, () => this.generateCalendar());
  },

  goToToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    }, () => this.generateCalendar());
  },

  showRecordStart() {
    this.setData({
      showStartModal: true,
      startDate: util.formatDate(new Date()),
      notes: ''
    });
  },

  showRecordEnd() {
    this.setData({
      showEndModal: true,
      endDate: util.formatDate(new Date())
    });
  },

  hideStartModal() {
    this.setData({ showStartModal: false });
  },

  hideEndModal() {
    this.setData({ showEndModal: false });
  },

  onStartDateChange(e) {
    this.setData({ startDate: e.detail.value });
  },

  onEndDateChange(e) {
    this.setData({ endDate: e.detail.value });
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  async submitStart() {
    const { startDate, notes } = this.data;
    if (!startDate) {
      wx.showToast({ title: '请选择日期', icon: 'error' });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });
      await api.recordPeriodStart(startDate, notes);
      wx.hideLoading();
      this.setData({ showStartModal: false });
      wx.showToast({ title: '记录成功', icon: 'success' });
      this.fetchPeriodData();
    } catch (err) {
      wx.hideLoading();
      console.error('记录失败', err);
      wx.showToast({ title: '记录失败', icon: 'error' });
    }
  },

  async submitEnd() {
    const { endDate, latestPeriodRecord } = this.data;
    if (!endDate) {
      wx.showToast({ title: '请选择日期', icon: 'error' });
      return;
    }
    if (!latestPeriodRecord || latestPeriodRecord.endDate) {
      wx.showToast({ title: '没有需要结束的记录', icon: 'error' });
      return;
    }

    try {
      wx.showLoading({ title: '提交中...' });
      await api.recordPeriodEnd(latestPeriodRecord.id, endDate);
      wx.hideLoading();
      this.setData({ showEndModal: false });
      wx.showToast({ title: '记录成功', icon: 'success' });
      this.fetchPeriodData();
    } catch (err) {
      wx.hideLoading();
      console.error('记录失败', err);
      wx.showToast({ title: '记录失败', icon: 'error' });
    }
  },

  onPeriodRecordTap(e) {
    const { record } = e.currentTarget.dataset;
    this.setData({
      selectedPeriodRecord: record,
      showPeriodEditModal: true,
      editStartDate: record.startDate.split('T')[0],
      editEndDate: record.endDate ? record.endDate.split('T')[0] : '',
      editNotes: record.notes || ''
    });
  },

  hidePeriodEditModal() {
    this.setData({ showPeriodEditModal: false, selectedPeriodRecord: null });
  },

  onEditStartDateChange(e) {
    this.setData({ editStartDate: e.detail.value });
  },

  onEditEndDateChange(e) {
    this.setData({ editEndDate: e.detail.value });
  },

  onEditNotesInput(e) {
    this.setData({ editNotes: e.detail.value });
  },

  async submitPeriodEdit() {
    const { selectedPeriodRecord, editStartDate, editEndDate, editNotes } = this.data;
    if (!editStartDate) {
      wx.showToast({ title: '请选择开始日期', icon: 'error' });
      return;
    }

    try {
      wx.showLoading({ title: '更新中...' });
      await api.updatePeriod(selectedPeriodRecord.id, {
        startDate: editStartDate,
        endDate: editEndDate || null,
        notes: editNotes
      });
      wx.hideLoading();
      this.setData({ showPeriodEditModal: false, selectedPeriodRecord: null });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.fetchPeriodData();
    } catch (err) {
      wx.hideLoading();
      console.error('更新失败', err);
      wx.showToast({ title: '更新失败', icon: 'error' });
    }
  },

  deletePeriodRecord() {
    const { selectedPeriodRecord } = this.data;
    if (!selectedPeriodRecord) return;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async res => {
        if (!res.confirm) return;

        try {
          wx.showLoading({ title: '删除中...' });
          await api.deletePeriod(selectedPeriodRecord.id);
          wx.hideLoading();
          this.setData({ showPeriodEditModal: false, selectedPeriodRecord: null });
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.fetchPeriodData();
        } catch (err) {
          wx.hideLoading();
          console.error('删除失败', err);
          wx.showToast({ title: '删除失败', icon: 'error' });
        }
      }
    });
  },

  async fetchCheckupRecords() {
    this.setData({ loadingCheckup: true });
    try {
      const records = await api.getCheckupList(this.data.checkupOwner);
      const formatted = (records || []).map(record => ({
        ...record,
        checkupDateFormatted: record.checkupDate ? record.checkupDate.split('T')[0] : '',
        abnormalCount: (record.items || []).filter(item => item.status !== 'Normal').length,
        normalCount: (record.items || []).filter(item => item.status === 'Normal').length,
        totalCount: (record.items || []).length
      }));
      this.setData({ checkupRecords: formatted, loadingCheckup: false });
    } catch (err) {
      console.error('获取体检记录失败', err);
      this.setData({ loadingCheckup: false });
    }
  },

  onCheckupOwnerChange(e) {
    const owner = e.currentTarget.dataset.owner;
    this.setData({ checkupOwner: owner }, () => this.fetchCheckupRecords());
  },

  goToCheckupDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/checkup/detail?id=${id}` });
  },

  goToAddCheckup() {
    const me = getApp().globalData.player;
    if (me && me !== this.data.checkupOwner) {
      wx.showToast({ title: '只能添加自己的体检记录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/checkup/add?owner=${this.data.checkupOwner}` });
  },

  onCheckupLongPress(e) {
    const me = getApp().globalData.player;
    if (me && me !== this.data.checkupOwner) {
      wx.showToast({ title: '只能编辑/删除自己的体检记录', icon: 'none' });
      return;
    }

    this.setData({
      showCheckupActionSheet: true,
      checkupActionSheetId: e.currentTarget.dataset.id
    });
  },

  hideCheckupActionSheet() {
    this.setData({ showCheckupActionSheet: false });
  },

  onEditCheckupAction() {
    const { checkupActionSheetId } = this.data;
    this.hideCheckupActionSheet();
    setTimeout(() => {
      wx.navigateTo({ url: `/pages/checkup/add?id=${checkupActionSheetId}&edit=true` });
    }, 200);
  },

  onDeleteCheckupAction() {
    const { checkupActionSheetId } = this.data;
    this.hideCheckupActionSheet();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条体检记录吗？',
      success: async res => {
        if (!res.confirm) return;

        try {
          await api.deleteCheckup(checkupActionSheetId, { loadingText: '删除中...' });
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.fetchCheckupRecords();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'error' });
        }
      }
    });
  }
});
