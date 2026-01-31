/**
 * 姨妈记录页面 - 日历视图 + 记录管理
 */
const api = require('../../utils/api');

Page({
  data: {
    // 导航栏
    statusBarHeight: 20,
    navbarHeight: 88,
    
    // 日历相关
    currentYear: 2026,
    currentMonth: 1,
    calendarDays: [],
    weekDays: ['日', '一', '二', '三', '四', '五', '六'],
    
    // 数据
    periodRecords: [],
    stats: null,
    latestRecord: null,
    periodDays: 1, // 经期第几天
    
    // 状态
    loading: false,
    showStartModal: false,
    showEndModal: false,
    
    // 表单
    startDate: '',
    endDate: '',
    notes: '',
    
    // 选中的记录（用于编辑）
    selectedRecord: null,
    showEditModal: false,
    editStartDate: '',
    editEndDate: '',
    editNotes: ''
  },

  onLoad() {
    this.initNavbar();
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1,
      startDate: this.formatDate(now),
      endDate: this.formatDate(now)
    });
  },

  onShow() {
    this.fetchData();
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

  // 获取所有数据
  async fetchData() {
    this.setData({ loading: true });
    
    try {
      const [recordsRes, stats] = await Promise.all([
        api.getPeriodList(),
        api.getPeriodStats()
      ]);
      
      const records = recordsRes.data || [];
      const latestRecord = records.length > 0 ? records[0] : null;
      
      // 计算经期第几天
      let periodDays = 1;
      if (latestRecord && latestRecord.startDate && !latestRecord.endDate) {
        // 提取日期部分，避免时区问题
        const startDateStr = latestRecord.startDate.substring(0, 10); // 取 YYYY-MM-DD
        const startParts = startDateStr.split('-');
        const startDate = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
        
        const today = new Date();
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        periodDays = Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) + 1;
      }
      
      this.setData({
        periodRecords: records,
        stats,
        latestRecord,
        periodDays,
        loading: false
      });
      
      this.generateCalendar();
    } catch (err) {
      console.error('获取数据失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  // 生成日历
  generateCalendar() {
    const { currentYear, currentMonth, periodRecords, stats } = this.data;
    
    // 获取当月第一天是周几
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const firstDayWeek = firstDay.getDay();
    
    // 获取当月天数
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // 获取上月天数
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
      
      // 检查是否在经期内
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
          // 没有结束日期，使用默认经期天数
          const avgPeriodDays = stats?.averagePeriodDays || 6;
          const predictedEnd = new Date(startDate);
          predictedEnd.setDate(predictedEnd.getDate() + avgPeriodDays - 1);
          
          if (dateObj >= startDate && dateObj <= predictedEnd) {
            isPeriod = true;
            if (dateObj > startDate && !this.isSameDay(dateObj, startDate)) {
              isPredicted = true; // 预测的经期日期
            }
          }
        }
      }
      
      // 预测下次经期
      if (!isPeriod && stats?.predictedNextStart) {
        const predictedStart = new Date(stats.predictedNextStart);
        const avgPeriodDays = stats.averagePeriodDays || 6;
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
    
    // 下月填充（补齐到42天，6行）
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

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 切换月份
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

  // 返回今天
  goToToday() {
    const now = new Date();
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    }, () => {
      this.generateCalendar();
    });
  },

  // 显示记录开始弹窗
  showRecordStart() {
    this.setData({
      showStartModal: true,
      startDate: this.formatDate(new Date()),
      notes: ''
    });
  },

  // 显示记录结束弹窗
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

  // 提交开始记录
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
      this.fetchData();
    } catch (err) {
      wx.hideLoading();
      console.error('记录失败', err);
      wx.showToast({ title: '记录失败', icon: 'error' });
    }
  },

  // 提交结束记录
  async submitEnd() {
    const { endDate, latestRecord } = this.data;
    
    if (!endDate) {
      wx.showToast({ title: '请选择日期', icon: 'error' });
      return;
    }
    
    if (!latestRecord || latestRecord.endDate) {
      wx.showToast({ title: '没有需要结束的记录', icon: 'error' });
      return;
    }
    
    try {
      wx.showLoading({ title: '提交中...' });
      await api.recordPeriodEnd(latestRecord.id, endDate);
      wx.hideLoading();
      
      this.setData({ showEndModal: false });
      wx.showToast({ title: '记录成功', icon: 'success' });
      this.fetchData();
    } catch (err) {
      wx.hideLoading();
      console.error('记录失败', err);
      wx.showToast({ title: '记录失败', icon: 'error' });
    }
  },

  // 点击记录查看详情
  onRecordTap(e) {
    const { record } = e.currentTarget.dataset;
    this.setData({
      selectedRecord: record,
      showEditModal: true,
      editStartDate: record.startDate.split('T')[0],
      editEndDate: record.endDate ? record.endDate.split('T')[0] : '',
      editNotes: record.notes || ''
    });
  },

  hideEditModal() {
    this.setData({ showEditModal: false, selectedRecord: null });
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

  // 更新记录
  async submitEdit() {
    const { selectedRecord, editStartDate, editEndDate, editNotes } = this.data;
    
    if (!editStartDate) {
      wx.showToast({ title: '请选择开始日期', icon: 'error' });
      return;
    }
    
    try {
      wx.showLoading({ title: '更新中...' });
      await api.updatePeriod(selectedRecord.id, {
        startDate: editStartDate,
        endDate: editEndDate || null,
        notes: editNotes
      });
      wx.hideLoading();
      
      this.setData({ showEditModal: false, selectedRecord: null });
      wx.showToast({ title: '更新成功', icon: 'success' });
      this.fetchData();
    } catch (err) {
      wx.hideLoading();
      console.error('更新失败', err);
      wx.showToast({ title: '更新失败', icon: 'error' });
    }
  },

  // 删除记录
  async deleteRecord() {
    const { selectedRecord } = this.data;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await api.deletePeriod(selectedRecord.id);
            wx.hideLoading();
            
            this.setData({ showEditModal: false, selectedRecord: null });
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.fetchData();
          } catch (err) {
            wx.hideLoading();
            console.error('删除失败', err);
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  // 返回
  goBack() {
    wx.navigateBack();
  }
});
