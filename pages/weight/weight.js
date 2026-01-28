/**
 * 体重追踪页面
 * 支持记录、修改、删除体重数据
 * 使用原生Canvas折线图展示趋势
 */
const api = require('../../utils/api');
const util = require('../../utils/util');

// 人员配置：名称、颜色、emoji
const PERSON_CONFIG = {
  '猪': { color: '#FF6B6B', emoji: '🐷', lineColor: '#FF6B6B' },
  '驴': { color: '#4ECDC4', emoji: '🫏', lineColor: '#4ECDC4' },
  '豌豆黄': { color: '#F4D03F', emoji: '🟡', lineColor: '#F4D03F' },
  '小立夏': { color: '#27AE60', emoji: '🌱', lineColor: '#27AE60' }
};

const PERSON_LIST = ['猪', '驴', '豌豆黄', '小立夏'];

Page({
  data: {
    // 数据列表
    weightRecords: [],
    groupedRecords: {}, // 按人员分组的记录
    
    // 统计数据
    latestWeights: {}, // 每人最新体重
    
    // 表单数据
    showForm: false,
    editingId: null,
    formPersonIndex: 0,
    formWeight: '',
    formDate: '',
    personList: PERSON_LIST,
    personConfig: PERSON_CONFIG,
    
    // 时间范围筛选
    timeRange: 'all', // 'week', 'month', '3month', 'all'
    
    // 加载状态
    loading: false,
    
    // 操作菜单
    showActionSheet: false,
    actionSheetId: '',
    actionSheetPerson: ''
  },

  onLoad() {
    // 设置默认日期为今天
    this.setData({
      formDate: util.formatDate(new Date())
    });
    this.fetchWeightRecords();
  },

  onReady() {
    // 获取canvas上下文
    this.initCanvas();
  },

  onShow() {
    this.fetchWeightRecords();
  },

  // ==================== 数据获取 ====================
  
  async fetchWeightRecords() {
    this.setData({ loading: true });

    try {
      const records = await api.get('/Weight/list');
      
      // 按人员分组
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
      
      // 获取每人最新体重
      PERSON_LIST.forEach(person => {
        const personRecords = grouped[person];
        if (personRecords.length > 0) {
          // 按日期排序，获取最新的
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

      // 更新图表
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

  // ==================== 图表相关 ====================

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
    
    // 清除画布
    ctx.clearRect(0, 0, width, height);
    
    // 背景
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    
    // 图表边距
    const padding = { left: 35, right: 5, top: 15, bottom: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // 收集所有日期和数据
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

    // 排序日期
    let sortedDates = Array.from(allDates).sort();
    
    // 根据时间范围筛选
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
      // 绘制空状态
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('暂无数据', width / 2, height / 2);
      return;
    }
    
    // 计算Y轴范围
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
    
    // Y轴范围留一些余量
    const yRange = maxWeight - minWeight || 10;
    minWeight = Math.floor(minWeight - yRange * 0.1);
    maxWeight = Math.ceil(maxWeight + yRange * 0.1);
    
    // 绘制网格线
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }
    
    // 绘制Y轴标签
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      const value = maxWeight - ((maxWeight - minWeight) / ySteps) * i;
      ctx.fillText(value.toFixed(0), padding.left - 8, y + 4);
    }
    
    // 绘制X轴标签
    ctx.textAlign = 'center';
    const xStep = chartWidth / Math.max(sortedDates.length - 1, 1);
    
    // 决定显示哪些标签（避免重叠）
    const maxLabels = Math.floor(chartWidth / 40);
    const labelStep = Math.max(1, Math.ceil(sortedDates.length / maxLabels));
    
    sortedDates.forEach((dateStr, index) => {
      if (index % labelStep === 0 || index === sortedDates.length - 1) {
        const x = padding.left + xStep * index;
        const date = new Date(dateStr);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        ctx.fillText(label, x, height - padding.bottom + 20);
      }
    });
    
    // 绘制每个人的折线
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
        
        // 绘制折线
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
        
        // 绘制数据点
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
    
    // 绘制图例
    const legendY = height - 15;
    const legendItemWidth = 60;
    const legendStartX = (width - legendItemWidth * PERSON_LIST.length) / 2;
    
    PERSON_LIST.forEach((person, index) => {
      const config = PERSON_CONFIG[person];
      const x = legendStartX + index * legendItemWidth;
      
      // 图例颜色块
      ctx.fillStyle = config.lineColor;
      ctx.fillRect(x, legendY - 6, 16, 8);
      
      // 图例文字
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(person, x + 20, legendY);
    });
  },

  // 时间范围切换
  onTimeRangeChange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    this.drawChart();
  },

  // ==================== 表单操作 ====================

  showAddForm() {
    this.setData({
      showForm: true,
      editingId: null,
      formPersonIndex: 0,
      formWeight: '',
      formDate: util.formatDate(new Date())
    });
  },

  showEditForm(record) {
    const personIndex = PERSON_LIST.indexOf(record.personName);
    this.setData({
      showForm: true,
      editingId: record.id,
      formPersonIndex: personIndex >= 0 ? personIndex : 0,
      formWeight: String(record.weight),
      formDate: record.recordDate.split('T')[0]
    });
  },

  hideForm() {
    this.setData({
      showForm: false,
      editingId: null
    });
  },

  onPersonChange(e) {
    this.setData({
      formPersonIndex: parseInt(e.detail.value)
    });
  },

  onWeightInput(e) {
    let value = e.detail.value;
    // 限制为数字和一位小数
    if (value && !/^\d*\.?\d{0,1}$/.test(value)) {
      value = this.data.formWeight;
    }
    this.setData({ formWeight: value });
  },

  onDateChange(e) {
    this.setData({
      formDate: e.detail.value
    });
  },

  async submitForm() {
    const { editingId, formPersonIndex, formWeight, formDate } = this.data;

    if (!formWeight || parseFloat(formWeight) <= 0) {
      wx.showToast({ title: '请输入有效体重', icon: 'error' });
      return;
    }

    const personName = PERSON_LIST[formPersonIndex];
    const weight = parseFloat(formWeight);
    const recordDate = new Date(formDate).toISOString();

    try {
      wx.showLoading({ title: '保存中...' });

      if (editingId) {
        // 更新
        await api.put(`/Weight/${editingId}`, {
          personName,
          weight,
          recordDate
        });
        wx.showToast({ title: '修改成功', icon: 'success' });
      } else {
        // 创建
        await api.post('/Weight', {
          personName,
          weight,
          recordDate
        });
        wx.showToast({ title: '添加成功', icon: 'success' });
      }

      this.hideForm();
      this.fetchWeightRecords();
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      wx.hideLoading();
    }
  },

  // ==================== 列表操作 ====================

  onRecordTap(e) {
    const { id } = e.currentTarget.dataset;
    const record = this.data.weightRecords.find(r => r.id === id);
    if (record) {
      this.showEditForm(record);
    }
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
    this.setData({
      showActionSheet: false,
      actionSheetId: '',
      actionSheetPerson: ''
    });
  },

  onEditAction() {
    const { actionSheetId } = this.data;
    const record = this.data.weightRecords.find(r => r.id === actionSheetId);
    this.hideActionSheet();
    if (record) {
      this.showEditForm(record);
    }
  },

  async onDeleteAction() {
    const { actionSheetId } = this.data;

    this.hideActionSheet();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条体重记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await api.del(`/Weight/${actionSheetId}`);
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchWeightRecords();
          } catch (err) {
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'error' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 返回首页
  goBack() {
    wx.navigateBack();
  }
});
