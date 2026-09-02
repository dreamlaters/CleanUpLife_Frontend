const api = require('../../utils/api');
const util = require('../../utils/util');

const PERSON_CONFIG = {
  '豌豆黄': { color: '#B98232', emoji: '🟡', lineColor: '#B98232' },
  '小立夏': { color: '#6F8A65', emoji: '🌱', lineColor: '#6F8A65' }
};

const PERSON_LIST = ['豌豆黄', '小立夏'];

const PLAYER_CONFIG = {
  Pig: { emoji: '🐷', name: '猪猪', color: '#C96F55' },
  Donkey: { emoji: '🫏', name: '毛驴', color: '#6F8A65' },
  Other: { emoji: '👤', name: '其他', color: '#8C7B6D' }
};

const LONG_PLAY_SECONDS = 4 * 3600;

Page({
  data: {
    statusBarHeight: 20,
    navbarHeight: 88,

    catSubTab: 'weight',
    catTabs: [
      { value: 'weight', label: '体重', icon: 'trend' },
      { value: 'play', label: '陪玩', icon: 'timer' }
    ],

    personList: PERSON_LIST,
    personConfig: PERSON_CONFIG,
    weightRecords: [],
    groupedRecords: { '豌豆黄': [], '小立夏': [] },
    displayRecords: { '豌豆黄': [], '小立夏': [] },
    latestWeights: {},
    timeRange: 'all',
    loadingWeight: false,

    showWeightForm: false,
    editingWeightId: null,
    formPersonIndex: 0,
    formWeight: '',
    formDate: '',
    showWeightActionSheet: false,
    weightActionSheetId: '',
    weightActionSheetPerson: '',

    playerConfig: PLAYER_CONFIG,
    playStatus: null,
    playElapsedText: '00:00',
    playStarting: false,
    loadingPlay: false,
    playStatsRange: 'week',
    playStatsView: null,
    playRecords: [],

    showPlayEditModal: false,
    editPlayId: '',
    editPlayerEmoji: '',
    editPlayerName: '',
    editPlayStartDate: '',
    editPlayStartTime: '',
    editPlayEndDate: '',
    editPlayEndTime: ''
  },

  onLoad(options) {
    this.initNavbar();
    this.setData({ formDate: util.formatDate(new Date()) });
    const rememberedTab = wx.getStorageSync('cat:lastTab');
    const initialTab = options && (options.tab === 'weight' || options.tab === 'play')
      ? options.tab
      : (rememberedTab === 'play' ? 'play' : 'weight');
    this.setData({ catSubTab: initialTab });
  },

  onReady() {
    this._pageReady = true;
    if (this.data.catSubTab === 'weight') {
      this.initCanvas();
    }
  },

  onShow() {
    const app = getApp();
    const target = app.globalData && app.globalData.targetCatTab;
    if (target === 'weight' || target === 'play') {
      app.globalData.targetCatTab = null;
      this.setData({ catSubTab: target });
      wx.setStorageSync('cat:lastTab', target);
    }

    if (this.data.catSubTab === 'play') {
      this.fetchPlayAll();
      return;
    }

    this.stopPlayTimer();
    this.fetchWeightRecords();
    if (this._pageReady) {
      setTimeout(() => this.initCanvas(), 100);
    }
  },

  onHide() {
    this.stopPlayTimer();
  },

  onUnload() {
    this.stopPlayTimer();
    this.canvas = null;
    this.ctx = null;
  },

  initNavbar() {
    const systemInfo = getApp().getSystemInfo();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    this.setData({
      statusBarHeight,
      navbarHeight: statusBarHeight + 44 + 10
    });
  },

  stopPropagation() {},

  switchCatSubTab(e) {
    const sub = e.detail && e.detail.value
      ? e.detail.value
      : e.currentTarget.dataset.sub;
    if (sub !== 'weight' && sub !== 'play') return;

    if (sub === this.data.catSubTab) {
      if (sub === 'weight') {
        this.fetchWeightRecords();
      } else {
        this.fetchPlayAll();
      }
      return;
    }

    this.setData({ catSubTab: sub }, () => {
      wx.setStorageSync('cat:lastTab', sub);
      if (sub === 'weight') {
        this.stopPlayTimer();
        this.fetchWeightRecords();
        setTimeout(() => this.initCanvas(), 100);
      } else {
        this.fetchPlayAll();
      }
    });
  },

  async fetchWeightRecords() {
    this.setData({ loadingWeight: true });
    try {
      const records = await api.get('/Weight/list');
      const grouped = {};
      const latest = {};
      const display = {};

      PERSON_LIST.forEach(person => {
        grouped[person] = [];
      });

      (records || []).forEach(record => {
        if (grouped[record.personName]) {
          grouped[record.personName].push({
            ...record,
            recordDateFormatted: this.formatDisplayDate(record.recordDate)
          });
        }
      });

      PERSON_LIST.forEach(person => {
        const personRecords = grouped[person];
        personRecords.sort((a, b) => new Date(b.recordDate) - new Date(a.recordDate));
        if (personRecords.length > 0) {
          latest[person] = personRecords[0].weight;
        }
        display[person] = personRecords.slice(0, 6);
      });

      this.setData({
        weightRecords: records || [],
        groupedRecords: grouped,
        displayRecords: display,
        latestWeights: latest,
        loadingWeight: false
      });

      if (this.data.catSubTab === 'weight') {
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

  initCanvas() {
    if (this.data.catSubTab !== 'weight' || this.data.showWeightForm) return;
    wx.createSelectorQuery()
      .select('#weight-canvas')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res[0] || !res[0].node) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = getApp().getSystemInfo().pixelRatio || 2;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvasWidth = res[0].width;
        this.canvasHeight = res[0].height;
        this.drawChart();
      });
  },

  drawChart() {
    if (!this.ctx || this.data.catSubTab !== 'weight') return;

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
      (groupedRecords[person] || []).forEach(record => {
        const dateKey = record.recordDate.split('T')[0];
        allDates.add(dateKey);
        seriesData[person][dateKey] = record.weight;
      });
    });

    let sortedDates = Array.from(allDates).sort();
    if (timeRange !== 'all' && sortedDates.length > 0) {
      const now = new Date();
      let days = 0;
      if (timeRange === 'week') days = 7;
      if (timeRange === 'month') days = 30;
      if (timeRange === '3month') days = 90;
      if (days) {
        const startDate = new Date(now.getTime() - days * 86400000);
        sortedDates = sortedDates.filter(date => new Date(date) >= startDate);
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
        const value = seriesData[person][date];
        if (value !== undefined) {
          minWeight = Math.min(minWeight, value);
          maxWeight = Math.max(maxWeight, value);
        }
      });
    });

    const yRange = maxWeight - minWeight || 10;
    minWeight = Math.floor(minWeight - yRange * 0.1);
    maxWeight = Math.ceil(maxWeight + yRange * 0.1);

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

    ctx.fillStyle = '#6a5c50';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= ySteps; i++) {
      const y = padding.top + (chartHeight / ySteps) * i;
      const value = maxWeight - ((maxWeight - minWeight) / ySteps) * i;
      ctx.fillText(value.toFixed(0), padding.left - 8, y + 4);
    }

    ctx.textAlign = 'center';
    const xStep = chartWidth / Math.max(sortedDates.length - 1, 1);
    const maxLabels = Math.floor(chartWidth / 40);
    const labelStep = Math.max(1, Math.ceil(sortedDates.length / maxLabels));
    sortedDates.forEach((dateStr, index) => {
      if (index % labelStep === 0 || index === sortedDates.length - 1) {
        const x = padding.left + xStep * index;
        const date = new Date(dateStr);
        ctx.fillText(`${date.getMonth() + 1}/${date.getDate()}`, x, height - padding.bottom + 18);
      }
    });

    PERSON_LIST.forEach(person => {
      const points = [];
      sortedDates.forEach((date, index) => {
        const value = seriesData[person][date];
        if (value !== undefined) {
          points.push({
            x: padding.left + xStep * index,
            y: padding.top + chartHeight - ((value - minWeight) / (maxWeight - minWeight)) * chartHeight
          });
        }
      });
      if (!points.length) return;

      ctx.strokeStyle = PERSON_CONFIG[person].lineColor;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();

      points.forEach(point => {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PERSON_CONFIG[person].lineColor;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  },

  onTimeRangeChange(e) {
    this.setData({ timeRange: e.currentTarget.dataset.range });
    this.drawChart();
  },

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
      setTimeout(() => this.initCanvas(), 100);
    });
  },

  onPersonSelect(e) {
    this.setData({ formPersonIndex: parseInt(e.currentTarget.dataset.index, 10) });
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
    const record = (this.data.groupedRecords[person] || []).find(item => item.id === id);
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
      const records = this.data.groupedRecords[weightActionSheetPerson] || [];
      const record = records.find(item => item.id === weightActionSheetId);
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
    const id = this.data.weightActionSheetId;
    this.hideWeightActionSheet();
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async res => {
        if (!res.confirm) return;
        try {
          await api.del(`/Weight/${id}`, { loadingText: '删除中...' });
          wx.showToast({ title: '删除成功', icon: 'success' });
          this.fetchWeightRecords();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'error' });
        }
      }
    });
  },

  async fetchPlayAll() {
    this.setData({ loadingPlay: true });
    try {
      const [status, stats, records] = await Promise.all([
        api.getPlayStatus(),
        api.getPlayStats(),
        api.getPlayList()
      ]);
      this.setData({
        playStatus: status || null,
        playStatsView: this.buildPlayStatsView(stats),
        playRecords: (records || []).map(record => this.formatPlayRecord(record)),
        loadingPlay: false
      });

      if (status && status.ongoing) {
        this._playElapsed = status.elapsedSeconds || 0;
        this.setData({ playElapsedText: this.formatElapsed(this._playElapsed) });
        this.startPlayTimer();
      } else {
        this.stopPlayTimer();
        this.setData({ playElapsedText: '00:00' });
      }
    } catch (err) {
      console.error('获取陪玩数据失败', err);
      this.setData({ loadingPlay: false });
    }
  },

  startPlayTimer() {
    this.stopPlayTimer();
    this._playTimer = setInterval(() => {
      this._playElapsed = (this._playElapsed || 0) + 1;
      this.setData({ playElapsedText: this.formatElapsed(this._playElapsed) });
    }, 1000);
  },

  stopPlayTimer() {
    if (this._playTimer) {
      clearInterval(this._playTimer);
      this._playTimer = null;
    }
  },

  async onStartPlay() {
    if (this.data.playStarting) return;
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}
    this.setData({ playStarting: true });
    try {
      await api.startPlay({ loadingText: '开始中...' });
      await this.fetchPlayAll();
    } catch (err) {
      console.error('开始陪玩失败', err);
      wx.showToast({ title: '开始失败', icon: 'error' });
    } finally {
      this.setData({ playStarting: false });
    }
  },

  async onEndPlay() {
    if (this.data.playStarting) return;
    try { wx.vibrateShort({ type: 'light' }); } catch (err) {}

    const elapsed = this._playElapsed || 0;
    if (elapsed > LONG_PLAY_SECONDS) {
      const confirmed = await new Promise(resolve => {
        wx.showModal({
          title: '确认结束？',
          content: `本次陪玩已超过 ${Math.floor(elapsed / 3600)} 小时，可能是忘记结束了。确定按这个时长记录吗？`,
          confirmText: '确认结束',
          cancelText: '再想想',
          success: res => resolve(res.confirm),
          fail: () => resolve(false)
        });
      });
      if (!confirmed) return;
    }

    this.setData({ playStarting: true });
    try {
      await api.endPlay({ loadingText: '结束中...' });
      wx.showToast({ title: '已记录', icon: 'success' });
      await this.fetchPlayAll();
    } catch (err) {
      console.error('结束陪玩失败', err);
      wx.showToast({ title: '结束失败', icon: 'error' });
    } finally {
      this.setData({ playStarting: false });
    }
  },

  onDiscardPlay() {
    const status = this.data.playStatus;
    if (!status || !status.ongoing || !status.sessionId) return;
    wx.showModal({
      title: '放弃本次陪玩？',
      content: '将删除这条进行中的记录，不计入统计。',
      confirmText: '放弃',
      confirmColor: '#ef4444',
      success: async res => {
        if (!res.confirm) return;
        try {
          await api.deletePlay(status.sessionId, { loadingText: '处理中...' });
          this.stopPlayTimer();
          await this.fetchPlayAll();
        } catch (err) {
          wx.showToast({ title: '操作失败', icon: 'error' });
        }
      }
    });
  },

  onPlayStatsRangeChange(e) {
    this.setData({ playStatsRange: e.currentTarget.dataset.range });
  },

  onPlayRecordLongPress(e) {
    const record = e.currentTarget.dataset.record;
    if (!record) return;
    if (!record.isMine) {
      wx.showToast({ title: '只能删除自己的记录', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条陪玩记录吗？',
      confirmColor: '#ef4444',
      success: async res => {
        if (!res.confirm) return;
        try {
          await api.deletePlay(record.id, { loadingText: '删除中...' });
          wx.showToast({ title: '已删除', icon: 'success' });
          await this.fetchPlayAll();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'error' });
        }
      }
    });
  },

  onPlayRecordTap(e) {
    const record = e.currentTarget.dataset.record;
    if (!record) return;
    if (!record.isMine) {
      wx.showToast({ title: '只能编辑自己的记录', icon: 'none' });
      return;
    }

    const config = PLAYER_CONFIG[record.player] || PLAYER_CONFIG.Other;
    const start = new Date(record.startTime);
    const startDate = `${start.getFullYear()}-${this.pad2(start.getMonth() + 1)}-${this.pad2(start.getDate())}`;
    const startTime = `${this.pad2(start.getHours())}:${this.pad2(start.getMinutes())}`;
    let endDate = '';
    let endTime = '';
    if (record.endTime) {
      const end = new Date(record.endTime);
      endDate = `${end.getFullYear()}-${this.pad2(end.getMonth() + 1)}-${this.pad2(end.getDate())}`;
      endTime = `${this.pad2(end.getHours())}:${this.pad2(end.getMinutes())}`;
    }

    this.setData({
      showPlayEditModal: true,
      editPlayId: record.id,
      editPlayerEmoji: config.emoji,
      editPlayerName: config.name,
      editPlayStartDate: startDate,
      editPlayStartTime: startTime,
      editPlayEndDate: endDate,
      editPlayEndTime: endTime
    });
  },

  hidePlayEditModal() {
    this.setData({ showPlayEditModal: false });
  },

  onPlayStartDateChange(e) {
    this.setData({ editPlayStartDate: e.detail.value });
  },

  onPlayStartTimeChange(e) {
    this.setData({ editPlayStartTime: e.detail.value });
  },

  onPlayEndDateChange(e) {
    this.setData({ editPlayEndDate: e.detail.value });
  },

  onPlayEndTimeChange(e) {
    this.setData({ editPlayEndTime: e.detail.value });
  },

  localPartsToIso(dateStr, timeStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0).toISOString();
  },

  async submitPlayEdit() {
    const {
      editPlayId,
      editPlayStartDate,
      editPlayStartTime,
      editPlayEndDate,
      editPlayEndTime
    } = this.data;

    if (!editPlayStartDate || !editPlayStartTime) {
      wx.showToast({ title: '请选择开始时间', icon: 'error' });
      return;
    }

    const hasEndDate = !!editPlayEndDate;
    const hasEndTime = !!editPlayEndTime;
    if (hasEndDate !== hasEndTime) {
      wx.showToast({ title: '结束日期和时间需一起填', icon: 'none' });
      return;
    }

    const startTime = this.localPartsToIso(editPlayStartDate, editPlayStartTime);
    let endTime = null;
    if (hasEndDate && hasEndTime) {
      endTime = this.localPartsToIso(editPlayEndDate, editPlayEndTime);
      if (new Date(endTime).getTime() < new Date(startTime).getTime()) {
        wx.showToast({ title: '结束不能早于开始', icon: 'none' });
        return;
      }
    }

    try {
      await api.updatePlay(editPlayId, { startTime, endTime }, { loadingText: '保存中...' });
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ showPlayEditModal: false });
      await this.fetchPlayAll();
    } catch (err) {
      console.error('保存陪玩记录失败', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    }
  },

  onDeletePlayFromEdit() {
    const id = this.data.editPlayId;
    if (!id) return;
    wx.showModal({
      title: '删除记录',
      content: '确定删除这条陪玩记录吗？',
      confirmColor: '#ef4444',
      success: async res => {
        if (!res.confirm) return;
        try {
          await api.deletePlay(id, { loadingText: '删除中...' });
          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({ showPlayEditModal: false });
          await this.fetchPlayAll();
        } catch (err) {
          wx.showToast({ title: '删除失败', icon: 'error' });
        }
      }
    });
  },

  pad2(value) {
    return value < 10 ? `0${value}` : String(value);
  },

  formatElapsed(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    if (hours > 0) {
      return `${this.pad2(hours)}:${this.pad2(minutes)}:${this.pad2(remainder)}`;
    }
    return `${this.pad2(minutes)}:${this.pad2(remainder)}`;
  },

  formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds || 0));
    if (seconds < 60) return seconds <= 0 ? '0分钟' : '不到1分钟';
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.round((seconds % 3600) / 60);
    if (minutes === 60) {
      hours += 1;
      minutes = 0;
    }
    if (hours > 0 && minutes > 0) return `${hours}小时${minutes}分`;
    if (hours > 0) return `${hours}小时`;
    return `${minutes}分钟`;
  },

  buildPlayStatsView(stats) {
    const source = stats || {};
    const formatRange = range => {
      const value = range || {};
      return {
        pig: this.formatDuration(value.pigSeconds),
        donkey: this.formatDuration(value.donkeySeconds),
        other: this.formatDuration(value.otherSeconds),
        pigSessions: value.pigSessions || 0,
        donkeySessions: value.donkeySessions || 0,
        otherSessions: value.otherSessions || 0,
        otherSecondsRaw: value.otherSeconds || 0
      };
    };
    return {
      week: formatRange(source.week),
      month: formatRange(source.month),
      year: formatRange(source.year)
    };
  },

  formatPlayRecord(record) {
    const config = PLAYER_CONFIG[record.player] || PLAYER_CONFIG.Other;
    const app = getApp();
    const myOpenId = app && app.globalData ? app.globalData.openid : '';
    const start = new Date(record.startTime);
    const startText = `${start.getMonth() + 1}/${start.getDate()} ${this.pad2(start.getHours())}:${this.pad2(start.getMinutes())}`;
    let rangeText = startText;

    if (record.endTime) {
      const end = new Date(record.endTime);
      const sameDay = start.getFullYear() === end.getFullYear()
        && start.getMonth() === end.getMonth()
        && start.getDate() === end.getDate();
      const endText = sameDay
        ? `${this.pad2(end.getHours())}:${this.pad2(end.getMinutes())}`
        : `${end.getMonth() + 1}/${end.getDate()} ${this.pad2(end.getHours())}:${this.pad2(end.getMinutes())}`;
      rangeText = `${startText} – ${endText}`;
    }

    return {
      id: record.id,
      player: record.player,
      playerEmoji: config.emoji,
      playerName: config.name,
      playerColor: config.color,
      rangeStr: rangeText,
      durationStr: record.endTime ? this.formatDuration(record.durationSeconds) : '进行中',
      ongoing: !record.endTime,
      startTime: record.startTime,
      endTime: record.endTime,
      isMine: !!myOpenId && record.openId === myOpenId
    };
  }
});
