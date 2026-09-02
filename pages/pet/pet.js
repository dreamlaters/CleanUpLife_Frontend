/**
 * 宠物页面逻辑
 * 体重追踪
 */
const api = require('../../utils/api');
const util = require('../../utils/util');

// 宠物配置
const PERSON_CONFIG = {
  '豌豆黄': { color: '#B98232', emoji: '🟡', lineColor: '#B98232' },
  '小立夏': { color: '#6F8A65', emoji: '🌱', lineColor: '#6F8A65' }
};

const PERSON_LIST = ['豌豆黄', '小立夏'];

Page({
  data: {
    // 导航栏
    statusBarHeight: 20,
    navbarHeight: 88,
    
    // 数据列表
    weightRecords: [],
    groupedRecords: {},
    latestWeights: {},
    
    // 表单数据
    showForm: false,
    editingId: null,
    formPersonIndex: 0,
    formWeight: '',
    formDate: '',
    personList: PERSON_LIST,
    personConfig: PERSON_CONFIG,
    
    // 时间范围
    timeRange: 'all',
    
    // 加载状态
    loading: false,
    
    // 操作菜单
    showActionSheet: false,
    actionSheetId: '',
    actionSheetPerson: ''
  },

  onLoad() {
    this.initNavbar();
    this.setData({
      formDate: util.formatDate(new Date())
    });
  },

  onReady() {
    this.initCanvas();
  },

  onShow() {
    this.fetchWeightRecords();
  },

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

  stopPropagation() {},

  // ==================== 数据获取 ====================
  async fetchWeightRecords() {
    this.setData({ loading: true });

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
        loading: false
      });

      this.drawChart();
    } catch (err) {
      console.error('获取体重记录失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '获取数据失败', icon: 'error' });
    }
  },

  formatDisplayDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  },

  // ==================== 图表 ====================
  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#weight-canvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          
          const dpr = wx.getSystemInfoSync().pixelRatio;
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
    ctx.fillStyle = '#fffaf2';
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
    ctx.strokeStyle = '#e6d8c8';
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
    ctx.fillStyle = '#6a5c50';
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

  // ==================== 表单 ====================
  showAddForm() {
    this.setData({
      showForm: true,
      editingId: null,
      formPersonIndex: 0,
      formWeight: '',
      formDate: util.formatDate(new Date())
    });
  },

  hideForm() {
    this.setData({
      showForm: false,
      editingId: null
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

  onDateChange(e) {
    this.setData({ formDate: e.detail.value });
  },

  async submitForm() {
    const { editingId, formPersonIndex, formWeight, formDate } = this.data;

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
      if (editingId) {
        await api.put(`/Weight/${editingId}`, { ...data, id: editingId }, { loadingText: '更新中...' });
        wx.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await api.post('/Weight', data, { loadingText: '添加中...' });
        wx.showToast({ title: '添加成功', icon: 'success' });
      }

      this.hideForm();
      this.fetchWeightRecords();
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  // ==================== 记录操作 ====================
  onRecordTap(e) {
    const { id, person } = e.currentTarget.dataset;
    const record = this.data.groupedRecords[person].find(r => r.id === id);
    if (!record) return;

    const personIndex = PERSON_LIST.indexOf(person);
    this.setData({
      showForm: true,
      editingId: record.id,
      formPersonIndex: personIndex >= 0 ? personIndex : 0,
      formWeight: String(record.weight),
      formDate: record.recordDate.split('T')[0]
    });
  },

  onRecordLongPress(e) {
    const { id, person } = e.currentTarget.dataset;
    this.setData({
      showActionSheet: true,
      actionSheetId: id,
      actionSheetPerson: person
    });
  },

  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  onEditAction() {
    const { actionSheetId, actionSheetPerson } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      const record = this.data.groupedRecords[actionSheetPerson].find(r => r.id === actionSheetId);
      if (!record) return;

      const personIndex = PERSON_LIST.indexOf(actionSheetPerson);
      this.setData({
        showForm: true,
        editingId: record.id,
        formPersonIndex: personIndex >= 0 ? personIndex : 0,
        formWeight: String(record.weight),
        formDate: record.recordDate.split('T')[0]
      });
    }, 200);
  },

  onDeleteAction() {
    const { actionSheetId } = this.data;
    this.hideActionSheet();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.del(`/Weight/${actionSheetId}`, { loadingText: '删除中...' });
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchWeightRecords();
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  }
});
