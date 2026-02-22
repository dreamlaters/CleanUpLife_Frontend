/**
 * 记录页面逻辑
 * 猫猫体重 + 姨妈记录 + 体检记录
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

// 宠物配置
const PERSON_CONFIG = {
  '豌豆黄': { color: '#F4D03F', emoji: '🟡', lineColor: '#F4D03F' },
  '小立夏': { color: '#27AE60', emoji: '🌱', lineColor: '#27AE60' }
};

const PERSON_LIST = ['豌豆黄', '小立夏'];

Page({
  data: {
    // 导航栏
    statusBarHeight: 20,
    navbarHeight: 88,
    
    // Tab切换
    currentTab: 'weight',
    
    // ==================== 体重相关 ====================
    weightRecords: [],
    groupedRecords: {},
    latestWeights: {},
    personList: PERSON_LIST,
    personConfig: PERSON_CONFIG,
    
    // 体重表单
    showWeightForm: false,
    editingWeightId: null,
    formPersonIndex: 0,
    formWeight: '',
    formDate: '',
    
    // 时间范围
    timeRange: 'all',
    loadingWeight: false,
    
    // 体重操作菜单
    showWeightActionSheet: false,
    weightActionSheetId: '',
    weightActionSheetPerson: '',
    
    // ==================== 姨妈相关 ====================
    // 日历
    currentYear: 2026,
    currentMonth: 1,
    calendarDays: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    
    // 数据
    periodRecords: [],
    periodStats: null,
    latestPeriodRecord: null,
    periodDays: 1,
    
    // 状态
    loadingPeriod: false,
    showStartModal: false,
    showEndModal: false,
    
    // 表单
    startDate: '',
    endDate: '',
    notes: '',
    
    // 选中的记录
    selectedPeriodRecord: null,
    showPeriodEditModal: false,
    editStartDate: '',
    editEndDate: '',
    editNotes: '',

    // ==================== 体检相关 ====================
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
    this.setData({
      formDate: util.formatDate(now),
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      startDate: this.formatDate(now),
      endDate: this.formatDate(now)
    });
    
    if (options.tab) {
      this.setData({ currentTab: options.tab });
    }
  },

  onReady() {
    if (this.data.currentTab === 'weight') {
      this.initCanvas();
    }
  },

  onShow() {
    // 检查是否有从其他页面跳转的 tab 指定
    const app = getApp();
    if (app.globalData && app.globalData.targetTab) {
      const targetTab = app.globalData.targetTab;
      app.globalData.targetTab = null;
      if (targetTab === 'weight' || targetTab === 'period' || targetTab === 'checkup') {
        this.setData({ currentTab: targetTab });
      }
    }
    
    this.fetchWeightRecords();
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

  // Tab切换
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    
    if (tab === 'weight') {
      setTimeout(() => {
        this.initCanvas();
      }, 100);
    }
    if (tab === 'checkup') {
      this.fetchCheckupRecords();
    }
  },

  // ==================== 体重功能 ====================
  async fetchWeightRecords() {
    this.setData({ loadingWeight: true });

    try {
      const records = await api.get('/Weight/list');
      
      const grouped = {};
      const latest = {};
      
      PERSON_LIST.forEach(person => {
        grouped[person] = [];
      });
      
      records.forEach(record => {
        if (grouped[record.personName]) {
          grouped[record.personName].push({
            ...record,
            recordDateFormatted: this.formatDisplayDate(record.recordDate)
          });
        }
      });
      
      PERSON_LIST.forEach(person => {
        const personRecords = grouped[person];
        if (personRecords.length > 0) {
          personRecords.sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate));
          latest[person] = personRecords[0].weight;
        }
      });

      this.setData({
        weightRecords: records,
        groupedRecords: grouped,
        latestWeights: latest,
        loadingWeight: false
      });

      if (this.data.currentTab === 'weight') {
        this.drawChart();
      }
    } catch (err) {
      console.error('获取体重记录失败', err);
      this.setData({ loadingWeight: false });
    }
  },

  formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  },

  // 图表
  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#weight-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          // 使用缓存的 systemInfo
          const app = getApp();
          const dpr = app.getSystemInfo().pixelRatio || 2;
          canvas.width = res[0].width * dpr;
          canvas.height = res[0].height * dpr;
          ctx.scale(dpr, dpr);
          
          this.canvas = canvas;
          this.ctx = ctx;
          this.canvasWidth = res[0].width;
          this.canvasHeight = res[0].height;
          
          this.drawChart();
        }
      });
  },

  drawChart() {
    if (!this.ctx) return;
    
    const ctx = this.ctx;
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    const { groupedRecords, timeRange } = this.data;
    
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);
    
    const padding = { left: 35, right: 10, top: 15, bottom: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    const allDates = new Set();
    const seriesData = {};
    
    PERSON_LIST.forEach(person => {
      seriesData[person] = {};
      const records = groupedRecords[person] || [];
      records.forEach(record => {
        const dateKey = record.recordDate.split('T')[0];
        allDates.add(dateKey);
        seriesData[person][dateKey] = record.weight;
      });
    });

    let sortedDates = Array.from(allDates).sort();
    
    if (timeRange !== 'all' && sortedDates.length > 0) {
      const now = new Date();
      let startDate;
      
      switch(timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3month':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
      }
      
      if (startDate) {
        sortedDates = sortedDates.filter(d => new Date(d) >= startDate);
      }
    }
    
    if (sortedDates.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', width / 2, height / 2);
      return;
    }
    
    let minWeight = Infinity;
    let maxWeight = -Infinity;
    
    PERSON_LIST.forEach(person => {
      sortedDates.forEach(date => {
        const val = seriesData[person][date];
        if (val !== undefined) {
          minWeight = Math.min(minWeight, val);
          maxWeight = Math.max(maxWeight, val);
        }
      });
    });
    
    const yRange = maxWeight - minWeight || 10;
    minWeight = Math.floor(minWeight - yRange * 0.1);
    maxWeight = Math.ceil(maxWeight + yRange * 0.1);
    
    // 网格线
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    // Y轴标签
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      const value = maxWeight - ((maxWeight - minWeight) / ySteps) * i;
      ctx.fillText(value.toFixed(0), padding.left - 8, y + 4);
    }
    
    // X轴标签
    ctx.textAlign = 'center';
    const xStep = chartWidth / Math.max(sortedDates.length - 1, 1);
    const maxLabels = Math.floor(chartWidth / 40);
    const labelStep = Math.max(1, Math.ceil(sortedDates.length / maxLabels));
    
    sortedDates.forEach((dateStr, index) => {
      if (index % labelStep === 0 || index === sortedDates.length - 1) {
        const x = padding.left + xStep * index;
        const date = new Date(dateStr);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(label, x, height - padding.bottom + 18);
      }
    });
    
    // 折线
    PERSON_LIST.forEach(person => {
      const points = [];
      sortedDates.forEach((date, index) => {
        const val = seriesData[person][date];
        if (val !== undefined) {
          const x = padding.left + xStep * index;
          const y = padding.top + chartHeight - ((val - minWeight) / (maxWeight - minWeight)) * chartHeight;
          points.push({ x, y, val });
        }
      });
      
      if (points.length > 0) {
        const config = PERSON_CONFIG[person];
        
        ctx.strokeStyle = config.lineColor;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
        
        // 数据点
        points.forEach(point => {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = config.lineColor;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  },

  onTimeRangeChange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    this.drawChart();
  },

  // 体重表单
  showAddWeightForm() {
    this.setData({
      showWeightForm: true,
      editingWeightId: null,
      formPersonIndex: 0,
      formWeight: '',
      formDate: util.formatDate(new Date())
    });
  },

  hideWeightForm() {
    this.setData({
      showWeightForm: false,
      editingWeightId: null
    }, () => {
      setTimeout(() => {
        this.initCanvas();
      }, 100);
    });
  },

  onPersonSelect(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ formPersonIndex: index });
  },

  onWeightInput(e) {
    let value = e.detail.value;
    if (value && !/^\d*\.?\d{0,1}$/.test(value)) {
      value = this.data.formWeight;
    }
    this.setData({ formWeight: value });
  },

  onWeightDateChange(e) {
    this.setData({ formDate: e.detail.value });
  },

  async submitWeightForm() {
    const { editingWeightId, formPersonIndex, formWeight, formDate } = this.data;

    if (!formWeight || parseFloat(formWeight) <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'error' });
      return;
    }

    const data = {
      personName: PERSON_LIST[formPersonIndex],
      weight: parseFloat(formWeight),
      recordDate: formDate
    };

    try {
      if (editingWeightId) {
        await api.put(`/Weight/${editingWeightId}`, { ...data, id: editingWeightId }, { loadingText: '更新中...' });
        wx.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await api.post('/Weight', data, { loadingText: '添加中...' });
        wx.showToast({ title: '添加成功', icon: 'success' });
      }

      this.hideWeightForm();
      this.fetchWeightRecords();
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  onWeightRecordTap(e) {
    const { id, person } = e.currentTarget.dataset;
    const record = this.data.groupedRecords[person].find(r => r.id === id);
    if (!record) return;

    const personIndex = PERSON_LIST.indexOf(person);
    this.setData({
      showWeightForm: true,
      editingWeightId: record.id,
      formPersonIndex: personIndex >= 0 ? personIndex : 0,
      formWeight: String(record.weight),
      formDate: record.recordDate.split('T')[0]
    });
  },

  onWeightRecordLongPress(e) {
    const { id, person } = e.currentTarget.dataset;
    this.setData({
      showWeightActionSheet: true,
      weightActionSheetId: id,
      weightActionSheetPerson: person
    });
  },

  hideWeightActionSheet() {
    this.setData({ showWeightActionSheet: false });
  },

  onEditWeightAction() {
    const { weightActionSheetId, weightActionSheetPerson } = this.data;
    this.hideWeightActionSheet();
    
    setTimeout(() => {
      const record = this.data.groupedRecords[weightActionSheetPerson].find(r => r.id === weightActionSheetId);
      if (!record) return;

      const personIndex = PERSON_LIST.indexOf(weightActionSheetPerson);
      this.setData({
        showWeightForm: true,
        editingWeightId: record.id,
        formPersonIndex: personIndex >= 0 ? personIndex : 0,
        formWeight: String(record.weight),
        formDate: record.recordDate.split('T')[0]
      });
    }, 200);
  },

  onDeleteWeightAction() {
    const { weightActionSheetId } = this.data;
    this.hideWeightActionSheet();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.del(`/Weight/${weightActionSheetId}`, { loadingText: '删除中...' });
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchWeightRecords();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  // ==================== 姨妈功能 ====================
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  async fetchPeriodData() {
    this.setData({ loadingPeriod: true });
    
    try {
      const [recordsRes, stats] = await Promise.all([
        api.getPeriodList(),
        api.getPeriodStats()
      ]);
      
      const records = recordsRes.data || [];
      const latestPeriodRecord = records.length > 0 ? records[0] : null;
      
      // 计算经期第几天
      let periodDays = 1;
      if (latestPeriodRecord && latestPeriodRecord.startDate && !latestPeriodRecord.endDate) {
        // 提取日期部分，避免时区问题
        const startDateStr = latestPeriodRecord.startDate.substring(0, 10); // 取 YYYY-MM-DD
        const startParts = startDateStr.split('-');
        const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
        
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        periodDays = Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) + 1;
      }
      
      // 四舍五入平均周期天数
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

  // 日历生成
  generateCalendar() {
    const { currentYear, currentMonth, periodRecords, periodStats } = this.data;
    
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const firstDayWeek = firstDay.getDay();
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    
    const days = [];
    
    // 上月填充
    for (let i = firstDayWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        isPeriod: false,
        isPredicted: false
      });
    }
    
    // 当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dateObj = new Date(currentYear, currentMonth - 1, i);
      
      let isPeriod = false;
      let isPredicted = false;
      let isStart = false;
      let isEnd = false;
      
      // 检查历史记录
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
          const avgPeriodDays = periodStats?.averagePeriodDays || 6;
          const predictedEnd = new Date(startDate);
          predictedEnd.setDate(predictedEnd.getDate() + avgPeriodDays - 1);
          
          if (dateObj >= startDate && dateObj <= predictedEnd) {
            isPeriod = true;
            if (dateObj > startDate && !this.isSameDay(dateObj, startDate)) {
              isPredicted = true;
            }
          }
        }
      }
      
      // 预测下次经期
      if (!isPeriod && periodStats?.predictedNextStart) {
        const predictedStart = new Date(periodStats.predictedNextStart);
        const avgPeriodDays = periodStats.averagePeriodDays || 6;
        const predictedEnd = new Date(predictedStart);
        predictedEnd.setDate(predictedEnd.getDate() + avgPeriodDays - 1);
        
        if (dateObj >= predictedStart && dateObj <= predictedEnd) {
          isPredicted = true;
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
    
    // 下月填充
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
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  },

  prevMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 1) {
      currentMonth = 12;
      currentYear--;
    } else {
      currentMonth--;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.generateCalendar();
    });
  },

  nextMonth() {
    let { currentYear, currentMonth } = this.data;
    if (currentMonth === 12) {
      currentMonth = 1;
      currentYear++;
    } else {
      currentMonth++;
    }
    this.setData({ currentYear, currentMonth }, () => {
      this.generateCalendar();
    });
  },

  goToToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    }, () => {
      this.generateCalendar();
    });
  },

  // 姨妈记录弹窗
  showRecordStart() {
    this.setData({
      showStartModal: true,
      startDate: this.formatDate(new Date()),
      notes: ''
    });
  },

  showRecordEnd() {
    this.setData({
      showEndModal: true,
      endDate: this.formatDate(new Date())
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

  async deletePeriodRecord() {
    const { selectedPeriodRecord } = this.data;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
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
      }
    });
  },

  // ==================== 体检功能 ====================
  async fetchCheckupRecords() {
    this.setData({ loadingCheckup: true });
    try {
      const records = await api.getCheckupList(this.data.checkupOwner);
      // 格式化日期
      const formatted = (records || []).map(r => ({
        ...r,
        checkupDateFormatted: r.checkupDate ? r.checkupDate.split('T')[0] : '',
        abnormalCount: (r.items || []).filter(i => i.status !== 'Normal').length,
        normalCount: (r.items || []).filter(i => i.status === 'Normal').length,
        totalCount: (r.items || []).length
      }));
      this.setData({ checkupRecords: formatted, loadingCheckup: false });
    } catch (err) {
      console.error('获取体检记录失败', err);
      this.setData({ loadingCheckup: false });
    }
  },

  onCheckupOwnerChange(e) {
    const owner = e.currentTarget.dataset.owner;
    this.setData({ checkupOwner: owner }, () => {
      this.fetchCheckupRecords();
    });
  },

  goToCheckupDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/checkup/detail?id=${id}` });
  },

  goToAddCheckup() {
    wx.navigateTo({ url: `/pages/checkup/add?owner=${this.data.checkupOwner}` });
  },

  onCheckupLongPress(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      showCheckupActionSheet: true,
      checkupActionSheetId: id
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
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteCheckup(checkupActionSheetId, { loadingText: '删除中...' });
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchCheckupRecords();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  }
});
