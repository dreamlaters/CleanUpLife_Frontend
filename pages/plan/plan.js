/**
 * 计划页面逻辑
 * 出行计划 + 年度目标
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
    currentTab: 'travel',
    
    // 出行计划
    travelTab: 'pending',
    travelList: [],
    pendingCount: 0,
    visitedCount: 0,
    loadingTravel: false,
    
    // 出行表单
    showTravelForm: false,
    editingTravelId: null,
    travelFormTypeIndex: 0,
    travelFormName: '',
    travelFormPriority: 1,
    travelRegion: [],
    travelRegionDisplay: '',
    travelCountryIndex: 0,
    countryList: constants.COUNTRY_LIST,
    
    // 年度目标
    goalCurrentYear: new Date().getFullYear(),
    goalYearList: [],
    goalYearIndex: 0,
    goalsPig: [],
    goalsDonkey: [],
    loadingGoals: false,
    
    // 目标表单
    showGoalForm: false,
    editingGoalId: null,
    goalFormOwner: 'Pig',
    goalFormTitle: '',
    goalFormYear: new Date().getFullYear(),
    goalFormYearList: [],
    goalFormYearIndex: 0,
    
    // 子目标相关
    expandedGoals: {},  // 展开状态 { goalId: true/false }
    showSubGoalForm: false,
    subGoalFormTitle: '',
    editingSubGoalId: null,
    currentGoalId: null,
    
    // 操作菜单
    showActionSheet: false,
    actionSheetTitle: '',
    actionSheetType: '',
    actionSheetId: ''
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
    if (app.globalData && app.globalData.targetTab) {
      const targetTab = app.globalData.targetTab;
      app.globalData.targetTab = null; // 清除
      this.setData({ currentTab: targetTab });
      if (targetTab === 'travel') {
        this.fetchTravelList();
      } else if (targetTab === 'goals') {
        this.fetchYearlyGoals();
      }
      return;
    }
    if (this.data.currentTab === 'travel') {
      this.fetchTravelList();
    } else {
      this.fetchYearlyGoals();
    }
  },

  initNavbar() {
    const app = getApp();
    const systemInfo = app.getSystemInfo();
    const statusBarHeight = systemInfo.statusBarHeight || 20;
    const navbarHeight = statusBarHeight + 44 + 10;
    this.setData({ statusBarHeight, navbarHeight });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'travel') {
      this.fetchTravelList();
    } else {
      this.fetchYearlyGoals();
    }
  },

  stopPropagation() {},

  // ==================== 出行计划 ====================
  switchTravelTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.travelTab) {
      this.setData({ travelTab: tab }, () => {
        this.fetchTravelList();
      });
    }
  },

  fetchTravelList() {
    this.setData({ loadingTravel: true });
    const status = this.data.travelTab === 'pending' 
      ? constants.TRAVEL_STATUS.PENDING 
      : constants.TRAVEL_STATUS.VISITED;
    
    // 同时获取两个Tab的数量
    Promise.all([
      api.get(`/Travel/status/${status}`, { showLoading: false }),
      api.get(`/Travel/status/${constants.TRAVEL_STATUS.PENDING}`, { showLoading: false }),
      api.get(`/Travel/status/${constants.TRAVEL_STATUS.VISITED}`, { showLoading: false })
    ]).then(([list, pendingList, visitedList]) => {
      const travelList = (list || []).map(item => ({
        ...item,
        displayName: this.formatTravelDisplayName(item),
        visitedDateFormatted: item.visitedDate ? util.formatYearMonth(item.visitedDate) : ''
      }));
      
      this.setData({ 
        travelList,
        pendingCount: (pendingList || []).length,
        visitedCount: (visitedList || []).length,
        loadingTravel: false 
      });
    }).catch(() => {
      this.setData({ loadingTravel: false });
    });
  },

  formatTravelDisplayName(item) {
    if (item.type === 'Domestic' && item.domesticLocation) {
      const loc = item.domesticLocation;
      let name = [loc.province, loc.city].filter(Boolean).join('-');
      if (item.name) name += `(${item.name})`;
      return name;
    } else if (item.type === 'International' && item.country) {
      let name = item.country;
      if (item.name) name += `(${item.name})`;
      return name;
    }
    return item.name || '';
  },

  showAddTravelForm() {
    this.setData({
      showTravelForm: true,
      editingTravelId: null,
      travelFormTypeIndex: 0,
      travelFormName: '',
      travelFormPriority: 1,
      travelRegion: [],
      travelRegionDisplay: '',
      travelCountryIndex: 0
    });
  },

  cancelTravelForm() {
    this.setData({ showTravelForm: false, editingTravelId: null });
  },

  onTravelTypeChange(e) {
    this.setData({
      travelFormTypeIndex: parseInt(e.detail.value),
      travelRegion: [],
      travelRegionDisplay: '',
      travelCountryIndex: 0
    });
  },

  onRegionChange(e) {
    const region = e.detail.value.filter(Boolean);
    this.setData({
      travelRegion: region,
      travelRegionDisplay: region.join('-')
    });
  },

  onCountryChange(e) {
    this.setData({ travelCountryIndex: parseInt(e.detail.value) });
  },

  onTravelNameInput(e) {
    this.setData({ travelFormName: e.detail.value });
  },

  onTravelPriorityChange(e) {
    this.setData({ travelFormPriority: e.detail.value });
  },

  submitTravelForm() {
    const { 
      travelFormTypeIndex, travelFormName, travelFormPriority, 
      travelRegion, countryList, travelCountryIndex, editingTravelId 
    } = this.data;

    const destination = {
      name: travelFormName,
      type: travelFormTypeIndex === 0 ? 'Domestic' : 'International',
      priority: travelFormPriority,
      status: 'Pending'
    };

    if (travelFormTypeIndex === 0) {
      destination.domesticLocation = {
        province: travelRegion[0] || '',
        city: travelRegion[1] || ''
      };
    } else {
      destination.country = countryList[travelCountryIndex] || '';
    }

    if (editingTravelId) {
      destination.id = editingTravelId;
      api.put(`/Travel/${editingTravelId}`, destination, { loadingText: '更新中...' })
        .then(() => {
          util.showSuccess('更新成功');
          this.setData({ showTravelForm: false, editingTravelId: null });
          this.fetchTravelList();
        })
        .catch(() => util.showError('更新失败'));
    } else {
      api.post('/Travel', destination, { loadingText: '添加中...' })
        .then(() => {
          util.showSuccess('添加成功');
          this.setData({ showTravelForm: false });
          this.fetchTravelList();
        })
        .catch(() => util.showError('添加失败'));
    }
  },

  onMarkVisited(e) {
    const id = e.currentTarget.dataset.id;
    util.showConfirm('确认标记', '确定要标记为已出行吗？')
      .then(confirmed => {
        if (confirmed) {
          api.post(`/Travel/${id}/visited`, {}, { loadingText: '标记中...' })
            .then(() => {
              util.showSuccess('标记成功');
              this.fetchTravelList();
            })
            .catch(() => util.showError('标记失败'));
        }
      });
  },

  showTravelActions(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.travelList.find(p => p.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.displayName : '操作',
      actionSheetType: 'travel',
      actionSheetId: id
    });
  },

  // ==================== 年度目标 ====================
  fetchYearlyGoals() {
    this.setData({ loadingGoals: true });
    const { goalCurrentYear } = this.data;
    
    Promise.all([
      api.get(`/YearlyGoal?year=${goalCurrentYear}`, { showLoading: false }),
      api.get('/YearlyGoal/years', { showLoading: false })
    ]).then(([goals, years]) => {
      const allGoals = (goals || []).map(g => ({
        ...g,
        subGoals: g.subGoals || [],
        progress: g.progress || 0,
        completedSubGoalsCount: g.completedSubGoalsCount || 0,
        totalSubGoalsCount: g.totalSubGoalsCount || 0
      }));
      const goalsPig = allGoals.filter(g => g.owner === 'Pig').sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.priority - b.priority;
      });
      const goalsDonkey = allGoals.filter(g => g.owner === 'Donkey').sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.priority - b.priority;
      });
      
      const currentYear = new Date().getFullYear();
      let yearList = years || [];
      if (!yearList.includes(currentYear)) {
        yearList = [currentYear, ...yearList];
      }
      yearList = [...new Set(yearList)].sort((a, b) => b - a);
      
      this.setData({
        goalsPig,
        goalsDonkey,
        goalYearList: yearList,
        goalYearIndex: yearList.indexOf(goalCurrentYear),
        loadingGoals: false
      });
    }).catch(() => {
      this.setData({ loadingGoals: false });
    });
  },

  onGoalYearChange(e) {
    const index = e.detail.value;
    const year = this.data.goalYearList[index];
    if (year && year !== this.data.goalCurrentYear) {
      this.setData({ goalCurrentYear: year }, () => {
        this.fetchYearlyGoals();
      });
    }
  },

  showAddGoalForm(e) {
    const owner = e.currentTarget.dataset.owner;
    const currentYear = new Date().getFullYear();
    const yearList = [];
    for (let y = 2020; y <= currentYear + 2; y++) {
      yearList.push(y);
    }
    
    this.setData({
      showGoalForm: true,
      goalFormOwner: owner,
      goalFormTitle: '',
      goalFormYear: currentYear,
      goalFormYearList: yearList,
      goalFormYearIndex: yearList.indexOf(currentYear),
      editingGoalId: null
    });
  },

  hideGoalForm() {
    this.setData({ showGoalForm: false, editingGoalId: null });
  },

  onGoalTitleInput(e) {
    this.setData({ goalFormTitle: e.detail.value });
  },

  onGoalFormYearChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      goalFormYearIndex: index,
      goalFormYear: this.data.goalFormYearList[index]
    });
  },

  submitGoalForm() {
    const { goalFormTitle, goalFormOwner, goalFormYear, editingGoalId } = this.data;
    
    if (!goalFormTitle.trim()) {
      util.showError('请输入目标内容');
      return;
    }
    
    const goal = {
      title: goalFormTitle.trim(),
      owner: goalFormOwner,
      year: goalFormYear,
      priority: 10
    };
    
    if (editingGoalId) {
      goal.id = editingGoalId;
      api.put(`/YearlyGoal/${editingGoalId}`, goal, { loadingText: '更新中...' })
        .then(() => {
          util.showSuccess('更新成功');
          this.setData({ showGoalForm: false, editingGoalId: null });
          if (goalFormYear !== this.data.goalCurrentYear) {
            this.setData({ goalCurrentYear: goalFormYear }, () => {
              this.fetchYearlyGoals();
            });
          } else {
            this.fetchYearlyGoals();
          }
        })
        .catch(() => util.showError('更新失败'));
    } else {
      api.post('/YearlyGoal', goal, { loadingText: '添加中...' })
        .then(() => {
          util.showSuccess('添加成功');
          this.setData({ showGoalForm: false, goalFormTitle: '' });
          if (goalFormYear !== this.data.goalCurrentYear) {
            this.setData({ goalCurrentYear: goalFormYear }, () => {
              this.fetchYearlyGoals();
            });
          } else {
            this.fetchYearlyGoals();
          }
        })
        .catch(() => util.showError('添加失败'));
    }
  },

  toggleGoalComplete(e) {
    const id = e.currentTarget.dataset.id;
    api.request({ url: `/YearlyGoal/${id}/toggle`, method: 'PATCH', showLoading: false })
      .then(() => {
        this.fetchYearlyGoals();
      })
      .catch(() => util.showError('操作失败'));
  },

  showGoalActions(e) {
    const id = e.currentTarget.dataset.id;
    const allGoals = [...this.data.goalsPig, ...this.data.goalsDonkey];
    const item = allGoals.find(g => g.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.title : '操作',
      actionSheetType: 'goal',
      actionSheetId: id
    });
  },

  // ==================== 操作菜单 ====================
  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  onActionEdit() {
    const { actionSheetType, actionSheetId, currentGoalId } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'travel') {
        this.showEditTravelForm(actionSheetId);
      } else if (actionSheetType === 'goal') {
        this.showEditGoalForm(actionSheetId);
      } else if (actionSheetType === 'subgoal') {
        this.showEditSubGoalForm(currentGoalId, actionSheetId);
      }
    }, 200);
  },

  onActionDelete() {
    const { actionSheetType, actionSheetId, currentGoalId } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'travel') {
        this.deleteTravel(actionSheetId);
      } else if (actionSheetType === 'goal') {
        this.deleteGoal(actionSheetId);
      } else if (actionSheetType === 'subgoal') {
        this.deleteSubGoal(currentGoalId, actionSheetId);
      }
    }, 200);
  },

  showEditTravelForm(id) {
    const item = this.data.travelList.find(p => p.id === id);
    if (!item) return;
    
    const isDomestic = item.type === 'Domestic';
    let region = [];
    let regionDisplay = '';
    let countryIndex = 0;
    
    if (isDomestic && item.domesticLocation) {
      region = [item.domesticLocation.province || '', item.domesticLocation.city || ''];
      regionDisplay = region.filter(Boolean).join('-');
    } else if (!isDomestic && item.country) {
      countryIndex = this.data.countryList.indexOf(item.country);
      if (countryIndex < 0) countryIndex = 0;
    }
    
    this.setData({
      showTravelForm: true,
      editingTravelId: item.id,
      travelFormTypeIndex: isDomestic ? 0 : 1,
      travelFormName: item.name || '',
      travelFormPriority: item.priority || 1,
      travelRegion: region,
      travelRegionDisplay: regionDisplay,
      travelCountryIndex: countryIndex
    });
  },

  showEditGoalForm(id) {
    const allGoals = [...this.data.goalsPig, ...this.data.goalsDonkey];
    const item = allGoals.find(g => g.id === id);
    if (!item) return;
    
    const currentYear = new Date().getFullYear();
    const yearList = [];
    for (let y = 2020; y <= currentYear + 2; y++) {
      yearList.push(y);
    }
    if (!yearList.includes(item.year)) {
      yearList.push(item.year);
      yearList.sort((a, b) => a - b);
    }
    
    this.setData({
      showGoalForm: true,
      goalFormOwner: item.owner,
      goalFormTitle: item.title,
      goalFormYear: item.year,
      goalFormYearList: yearList,
      goalFormYearIndex: yearList.indexOf(item.year),
      editingGoalId: id
    });
  },

  deleteTravel(id) {
    util.showConfirm('确认删除', '确定要删除该目的地吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/Travel/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchTravelList();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  deleteGoal(id) {
    util.showConfirm('确认删除', '确定要删除该目标吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/YearlyGoal/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchYearlyGoals();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  // ==================== 子目标相关 ====================
  
  // 展开/收起子目标
  toggleGoalExpand(e) {
    const id = e.currentTarget.dataset.id;
    const expanded = this.data.expandedGoals[id];
    this.setData({
      [`expandedGoals.${id}`]: !expanded
    });
  },

  // 切换子目标完成状态
  toggleSubGoalComplete(e) {
    const { goalId, subId } = e.currentTarget.dataset;
    
    // 获取当前目标状态，用于判断是否自动完成
    const allGoals = [...this.data.goalsPig, ...this.data.goalsDonkey];
    const goal = allGoals.find(g => g.id === goalId);
    const wasCompleted = goal?.completed;
    
    api.request({
      url: `/YearlyGoal/${goalId}/subgoals/${subId}/toggle`,
      method: 'PATCH',
      showLoading: false
    }).then((updatedGoal) => {
      // 检查主目标是否自动完成了
      if (!wasCompleted && updatedGoal && updatedGoal.completed) {
        util.showSuccess('目标完成！');
      }
      this.fetchYearlyGoals();
    }).catch(() => util.showError('操作失败'));
  },

  // 显示添加子目标表单
  showAddSubGoalForm(e) {
    const goalId = e.currentTarget.dataset.goalId;
    this.setData({
      showSubGoalForm: true,
      currentGoalId: goalId,
      subGoalFormTitle: '',
      editingSubGoalId: null
    });
  },

  // 隐藏子目标表单
  hideSubGoalForm() {
    this.setData({
      showSubGoalForm: false,
      currentGoalId: null,
      editingSubGoalId: null
    });
  },

  // 子目标标题输入
  onSubGoalTitleInput(e) {
    this.setData({ subGoalFormTitle: e.detail.value });
  },

  // 提交子目标表单
  submitSubGoalForm() {
    const { subGoalFormTitle, currentGoalId, editingSubGoalId } = this.data;
    
    if (!subGoalFormTitle.trim()) {
      util.showError('请输入子目标内容');
      return;
    }

    const data = { title: subGoalFormTitle.trim() };

    if (editingSubGoalId) {
      // 更新
      api.put(`/YearlyGoal/${currentGoalId}/subgoals/${editingSubGoalId}`, data, { loadingText: '更新中...' })
        .then(() => {
          util.showSuccess('更新成功');
          this.hideSubGoalForm();
          this.fetchYearlyGoals();
        })
        .catch(() => util.showError('更新失败'));
    } else {
      // 新增
      api.post(`/YearlyGoal/${currentGoalId}/subgoals`, data, { loadingText: '添加中...' })
        .then(() => {
          util.showSuccess('添加成功');
          this.hideSubGoalForm();
          this.fetchYearlyGoals();
        })
        .catch(() => util.showError('添加失败'));
    }
  },

  // 显示子目标操作菜单
  showSubGoalActions(e) {
    const { goalId, subId } = e.currentTarget.dataset;
    const allGoals = [...this.data.goalsPig, ...this.data.goalsDonkey];
    const goal = allGoals.find(g => g.id === goalId);
    const subGoal = goal?.subGoals?.find(s => s.id === subId);
    
    this.setData({
      showActionSheet: true,
      actionSheetTitle: subGoal ? subGoal.title : '子目标操作',
      actionSheetType: 'subgoal',
      actionSheetId: subId,
      currentGoalId: goalId
    });
  },

  // 显示编辑子目标表单
  showEditSubGoalForm(goalId, subGoalId) {
    const allGoals = [...this.data.goalsPig, ...this.data.goalsDonkey];
    const goal = allGoals.find(g => g.id === goalId);
    const subGoal = goal?.subGoals?.find(s => s.id === subGoalId);
    
    if (!subGoal) return;
    
    this.setData({
      showSubGoalForm: true,
      currentGoalId: goalId,
      subGoalFormTitle: subGoal.title,
      editingSubGoalId: subGoalId
    });
  },

  // 删除子目标
  deleteSubGoal(goalId, subGoalId) {
    util.showConfirm('确认删除', '确定要删除该子目标吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/YearlyGoal/${goalId}/subgoals/${subGoalId}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchYearlyGoals();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  }
});
