/**
 * 首页逻辑处理
 * 管理物品列表、待购物品、出行目的地
 * 现代化UI设计版本
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    // 物品列表
    products: [],
    filteredProducts: [],
    currentFilter: 'all',
    swipeIndex: -1,
    
    // 统计数据
    expiringSoonCount: 0,
    expiredCount: 0,
    
    // 待购物品
    toBuyProducts: [],
    toBuyPending: [],      // 未完成的待购
    toBuyCompleted: [],    // 已完成的待购
    showCompletedToBuy: false, // 是否展开已完成列表
    toBuySwipeIndex: -1,
    
    // 出行模块
    travelTab: 'pending',
    travelList: [],
    travelSwipeIndex: -1,
    showTravelForm: false,
    editingTravelId: null,  // 编辑模式下的目的地ID
    travelFormTypeIndex: 0,
    travelFormName: '',
    travelFormPriority: 1,
    travelRegion: [],
    travelRegionDisplay: '',
    travelCountryIndex: 0,
    // visited编辑表单
    showVisitedForm: false,
    editingVisitedId: null,
    visitedFormDate: '',
    visitedFormIsVisited: true,
    
    // 年度目标模块
    goalCurrentYear: new Date().getFullYear(),
    goalYearList: [],
    goalYearIndex: 0,
    goalsPig: [],
    goalsDonkey: [],
    goalArchivedYears: [],
    showGoalArchive: false,
    loadingGoals: false,
    showGoalForm: false,
    goalFormOwner: 'Pig',
    goalFormTitle: '',
    goalFormYear: new Date().getFullYear(),
    goalFormYearList: [],
    goalFormYearIndex: 0,
    editingGoalId: null,
    
    // 操作菜单
    showActionSheet: false,
    actionSheetTitle: '',
    actionSheetType: '',
    actionSheetId: '',
    actionSheetCategory: '',
    
    // 常量数据
    countryList: constants.COUNTRY_LIST,
    
    // 加载状态
    loadingProducts: false,
    loadingToBuy: false,
    loadingTravel: false,
    
    // 触摸状态
    touchStartX: 0,
    touchStartY: 0,
    isVerticalScroll: false,
    
    // 排序状态
    sortField: '',
    sortOrder: 'asc'
  },

  // ==================== 生命周期 ====================
  onLoad() {
    this._fetchAllData();
  },

  onShow() {
    this._fetchAllData();
  },

  // 获取所有数据
  _fetchAllData() {
    this.fetchProducts();
    this.fetchToBuyProducts();
    this.fetchTravelList();
    this.fetchYearlyGoals();
  },

  // ==================== 物品列表 ====================
  fetchProducts() {
    this.setData({ loadingProducts: true });
    api.get('/Products', { showLoading: false })
      .then(data => {
        const now = new Date();
        let expiringSoonCount = 0;
        let expiredCount = 0;
        
        const products = (data || []).map(item => {
          const bestByDate = new Date(item.bestBy);
          const diffDays = Math.ceil((bestByDate - now) / (1000 * 60 * 60 * 24));
          
          let dateClass = 'date-normal';
          if (diffDays < 0) {
            dateClass = 'date-expired';
            expiredCount++;
          } else if (diffDays <= 30) {
            dateClass = 'date-soon';
            expiringSoonCount++;
          }
          
          return Object.assign({}, item, {
            bestByFormatted: util.formatDate(item.bestBy),
            dateClass: dateClass,
            emoji: constants.CATEGORY_EMOJI[item.category] || '📦'
          });
        });
        
        this.setData({ 
          products,
          filteredProducts: products,
          expiringSoonCount,
          expiredCount,
          loadingProducts: false
        });
      })
      .catch(() => {
        this.setData({ loadingProducts: false });
        util.showError('数据加载失败');
      });
  },

  // 筛选切换
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    const { products } = this.data;
    
    let filteredProducts = products;
    if (filter !== 'all') {
      filteredProducts = products.filter(item => item.category === filter);
    }
    
    this.setData({ 
      currentFilter: filter,
      filteredProducts 
    });
  },

  // 显示物品操作菜单
  showItemActions(e) {
    const { id, category } = e.currentTarget.dataset;
    const item = this.data.products.find(p => p.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.name : '操作',
      actionSheetType: 'product',
      actionSheetId: id,
      actionSheetCategory: category || 'Product'
    });
  },

  // 显示待购操作菜单
  showToBuyActions(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.toBuyProducts.find(p => p.id === id);
    this.setData({
      showActionSheet: true,
      actionSheetTitle: item ? item.name : '操作',
      actionSheetType: 'tobuy',
      actionSheetId: id
    });
  },

  // 显示出行操作菜单
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

  // 隐藏操作菜单
  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  // 操作菜单 - 编辑
  onActionEdit() {
    const { actionSheetType, actionSheetId, actionSheetCategory } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'product') {
        wx.navigateTo({
          url: `/pages/update/update?id=${actionSheetId}&category=${actionSheetCategory}`
        });
      } else if (actionSheetType === 'tobuy') {
        wx.navigateTo({ url: `/pages/tobuy/update?id=${actionSheetId}` });
      } else if (actionSheetType === 'travel') {
        this.showEditTravelForm(actionSheetId);
      } else if (actionSheetType === 'goal') {
        this.showEditGoalForm(actionSheetId);
      }
    }, 200);
  },

  // 操作菜单 - 删除
  onActionDelete() {
    const { actionSheetType, actionSheetId } = this.data;
    this.hideActionSheet();
    
    setTimeout(() => {
      if (actionSheetType === 'product') {
        this._deleteProduct(actionSheetId);
      } else if (actionSheetType === 'tobuy') {
        this._deleteToBuy(actionSheetId);
      } else if (actionSheetType === 'travel') {
        this._deleteTravel(actionSheetId);
      } else if (actionSheetType === 'goal') {
        this._deleteGoal(actionSheetId);
      }
    }, 200);
  },

  _deleteProduct(id) {
    util.showConfirm('确认删除', '确定要删除该物品吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/Products/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchProducts();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  // 删除物品 (兼容旧调用)
  onDelete(e) {
    this._deleteProduct(e.currentTarget.dataset.id);
  },

  // 更新物品
  onUpdate(e) {
    const { id, category = 'Product' } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/update/update?id=${id}&category=${category}`
    });
  },

  // 跳转添加页面
  goToTarget() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  // 排序处理
  onSortByName() {
    this._sortProducts('name');
  },

  onSortByBestBy() {
    this._sortProducts('bestBy');
  },

  _sortProducts(field) {
    const { sortField, sortOrder, filteredProducts } = this.data;
    const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
    
    const sortedProducts = filteredProducts.slice().sort((a, b) => {
      if (field === 'name') {
        return newOrder === 'asc' 
          ? a.name.localeCompare(b.name, 'zh')
          : b.name.localeCompare(a.name, 'zh');
      }
      return newOrder === 'asc' 
        ? (a[field] > b[field] ? 1 : -1)
        : (a[field] < b[field] ? 1 : -1);
    });

    this.setData({
      filteredProducts: sortedProducts,
      sortField: field,
      sortOrder: newOrder
    });
  },

  // ==================== 待购物品 ====================
  fetchToBuyProducts() {
    this.setData({ loadingToBuy: true });
    api.get('/ToBuy', { showLoading: false })
      .then(data => {
        const list = (data || [])
          .map(item => Object.assign({}, item, {
            priority: item.priority ?? item.Priority ?? 0,
            name: item.name ?? item.Name ?? '',
            completed: item.completed ?? item.Completed ?? false
          }))
          .sort((a, b) => a.priority - b.priority);
        
        // 分组：未完成和已完成
        const toBuyPending = list.filter(item => !item.completed);
        const toBuyCompleted = list.filter(item => item.completed);
        
        this.setData({ 
          toBuyProducts: list,
          toBuyPending,
          toBuyCompleted,
          loadingToBuy: false
        });
      })
      .catch(() => {
        this.setData({ loadingToBuy: false });
      });
  },

  // 切换已完成列表展开/折叠
  toggleCompletedToBuyList() {
    this.setData({ showCompletedToBuy: !this.data.showCompletedToBuy });
  },

  // 清除所有已完成的待购
  clearCompletedToBuy() {
    if (!this.data.toBuyCompleted.length) return;
    
    util.showConfirm('清除已完成', `确定要清除 ${this.data.toBuyCompleted.length} 个已完成的待购物品吗？`)
      .then(confirmed => {
        if (confirmed) {
          api.del('/ToBuy/completed', { loadingText: '清除中...' })
            .then(() => {
              util.showSuccess('清除成功');
              this.setData({ showCompletedToBuy: false });
              this.fetchToBuyProducts();
            })
            .catch(() => util.showError('清除失败'));
        }
      });
  },

  goToAddToBuy() {
    wx.navigateTo({ url: '/pages/tobuy/add' });
  },

  _deleteToBuy(id) {
    util.showConfirm('确认删除', '确定要删除该待购物品吗？')
      .then(confirmed => {
        if (confirmed) {
          api.del(`/ToBuy/${id}`, { loadingText: '删除中...' })
            .then(() => {
              util.showSuccess('删除成功');
              this.fetchToBuyProducts();
            })
            .catch(() => util.showError('删除失败'));
        }
      });
  },

  onDeleteToBuy(e) {
    this._deleteToBuy(e.currentTarget.dataset.id);
  },

  onUpdateToBuy(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/tobuy/update?id=${id}` });
  },

  // 切换待购完成状态
  toggleToBuyComplete(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.toBuyProducts.find(p => p.id === id);
    if (!item) return;
    
    // 先乐观更新UI
    const newList = this.data.toBuyProducts.map(p => {
      if (p.id === id) {
        return Object.assign({}, p, { completed: !p.completed });
      }
      return p;
    });
    const toBuyPending = newList.filter(item => !item.completed);
    const toBuyCompleted = newList.filter(item => item.completed);
    this.setData({ toBuyProducts: newList, toBuyPending, toBuyCompleted });
    
    // 调用API持久化状态
    api.request({
      url: `/ToBuy/${id}/toggle-completed`,
      method: 'PATCH',
      showLoading: false
    }).catch(() => {
      // 如果API调用失败，恢复原状态
      const revertList = this.data.toBuyProducts.map(p => {
        if (p.id === id) {
          return Object.assign({}, p, { completed: !p.completed });
        }
        return p;
      });
      const revertPending = revertList.filter(item => !item.completed);
      const revertCompleted = revertList.filter(item => item.completed);
      this.setData({ toBuyProducts: revertList, toBuyPending: revertPending, toBuyCompleted: revertCompleted });
      wx.showToast({ title: '操作失败', icon: 'error' });
    });
  },

  // ==================== 出行模块 ====================
  fetchTravelList() {
    this.setData({ loadingTravel: true });
    const status = this.data.travelTab === 'pending' 
      ? constants.TRAVEL_STATUS.PENDING 
      : constants.TRAVEL_STATUS.VISITED;
    
    api.get(`/Travel/status/${status}`, { showLoading: false })
      .then(data => {
        const list = (data || [])
          .map(item => Object.assign({}, item, {
            displayName: this._formatTravelDisplayName(item),
            visitedDateFormatted: item.visitedDate ? util.formatYearMonth(item.visitedDate) : ''
          }));
        // visited列表已由后端按visitedDate倒序排序，pending列表由后端按priority排序
        this.setData({ travelList: list, loadingTravel: false });
      })
      .catch(() => {
        this.setData({ loadingTravel: false });
      });
  },

  _formatTravelDisplayName(item) {
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

  switchTravelTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.travelTab) {
      this.setData({ travelTab: tab, travelSwipeIndex: -1 }, () => {
        this.fetchTravelList();
      });
    }
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

  // 显示编辑出行表单
  showEditTravelForm(id) {
    const { travelTab, travelList } = this.data;
    const item = travelList.find(p => p.id === id);
    
    // 如果是visited列表，使用专用编辑表单
    if (travelTab === 'visited') {
      if (!item) {
        api.get(`/Travel/${id}`, { loadingText: '加载中...' })
          .then(data => {
            this._populateVisitedForm(data);
          })
          .catch(() => util.showError('获取数据失败'));
        return;
      }
      this._populateVisitedForm(item);
      return;
    }
    
    // pending列表使用原有表单
    if (!item) {
      api.get(`/Travel/${id}`, { loadingText: '加载中...' })
        .then(data => {
          this._populateTravelForm(data);
        })
        .catch(() => util.showError('获取数据失败'));
      return;
    }
    this._populateTravelForm(item);
  },

  // 填充visited编辑表单数据
  _populateVisitedForm(item) {
    let visitedDate = '';
    if (item.visitedDate) {
      // 只取年月
      visitedDate = util.formatYearMonth(item.visitedDate);
    }
    
    this.setData({
      showVisitedForm: true,
      editingVisitedId: item.id,
      visitedFormDate: visitedDate,
      visitedFormIsVisited: item.status === 'Visited'
    });
  },

  // visited表单状态改变
  onVisitedStatusChange(e) {
    this.setData({ visitedFormIsVisited: e.detail.value });
  },

  // visited表单日期改变
  onVisitedDateChange(e) {
    this.setData({ visitedFormDate: e.detail.value });
  },

  // 取消visited表单
  cancelVisitedForm() {
    this.setData({ showVisitedForm: false, editingVisitedId: null });
  },

  // 提交visited表单
  submitVisitedForm() {
    const { editingVisitedId, visitedFormDate, visitedFormIsVisited, travelList } = this.data;
    const item = travelList.find(p => p.id === editingVisitedId);
    
    if (!item) {
      util.showError('数据错误');
      return;
    }

    // 构建更新数据，保留原有字段
    const destination = {
      id: editingVisitedId,
      name: item.name,
      type: item.type,
      priority: item.priority,
      status: visitedFormIsVisited ? 'Visited' : 'Pending',
      domesticLocation: item.domesticLocation,
      country: item.country,
      // 年月格式默认为1号
      visitedDate: visitedFormIsVisited && visitedFormDate ? new Date(`${visitedFormDate}-01`).toISOString() : null
    };

    api.put(`/Travel/${editingVisitedId}`, destination, { loadingText: '更新中...' })
      .then(() => {
        util.showSuccess('更新成功');
        this.setData({ showVisitedForm: false, editingVisitedId: null });
        this.fetchTravelList();
      })
      .catch(() => util.showError('更新失败'));
  },

  // 填充出行表单数据
  _populateTravelForm(item) {
    const { countryList } = this.data;
    const isDomestic = item.type === 'Domestic';
    const typeIndex = isDomestic ? 0 : 1;
    
    let region = [];
    let regionDisplay = '';
    let countryIndex = 0;
    
    if (isDomestic && item.domesticLocation) {
      region = [item.domesticLocation.province || '', item.domesticLocation.city || ''];
      regionDisplay = region.filter(Boolean).join('-');
    } else if (!isDomestic && item.country) {
      countryIndex = countryList.indexOf(item.country);
      if (countryIndex < 0) countryIndex = 0;
    }
    
    this.setData({
      showTravelForm: true,
      editingTravelId: item.id,
      travelFormTypeIndex: typeIndex,
      travelFormName: item.name || '',
      travelFormPriority: item.priority || 1,
      travelRegion: region,
      travelRegionDisplay: regionDisplay,
      travelCountryIndex: countryIndex
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

    // 判断是新增还是编辑
    if (editingTravelId) {
      // 编辑模式 - 需要在body中包含id
      destination.id = editingTravelId;
      api.put(`/Travel/${editingTravelId}`, destination, { loadingText: '更新中...' })
        .then(() => {
          util.showSuccess('更新成功');
          this.setData({ showTravelForm: false, editingTravelId: null });
          this.fetchTravelList();
        })
        .catch(() => util.showError('更新失败'));
    } else {
      // 新增模式 - 后端会检查重复
      this._submitTravel(destination);
    }
  },

  // 提交新增出行目的地
  _submitTravel(destination, force = false) {
    const url = force ? '/Travel?force=true' : '/Travel';
    api.post(url, destination, { loadingText: '添加中...' })
      .then(() => {
        util.showSuccess('添加成功');
        this.setData({ showTravelForm: false });
        this.fetchTravelList();
      })
      .catch((err) => {
        if (err.statusCode === 409 && err.data?.duplicate) {
          // 后端返回重复记录，提示用户
          const duplicate = err.data.duplicate;
          // 兼容数字(1)和字符串('Visited')两种格式
          const isVisited = duplicate.status === 1 || duplicate.status === 'Visited';
          const statusText = isVisited ? '已去过' : '想去的';
          const locationName = this._formatTravelDisplayName(duplicate);
          util.showConfirm(
            '发现相似记录',
            `「${locationName}」已在${statusText}列表中，是否仍要添加？`
          ).then(confirmed => {
            if (confirmed) {
              this._submitTravel(destination, true);
            }
          });
        } else {
          util.showError('添加失败');
        }
      });
  },

  _deleteTravel(id) {
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

  onDeleteTravel(e) {
    this._deleteTravel(e.currentTarget.dataset.id);
  },

  onMarkVisited(e) {
    const id = e.currentTarget.dataset.id;
    util.showConfirm('确认标记', '确定要标记该目的地为已出行吗？')
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

  // ==================== 触摸事件处理 ====================
  // 物品列表触摸
  onTouchStart(e) {
    this._handleTouchStart(e, 'swipeIndex');
  },

  onTouchMove(e) {
    this._handleTouchMove(e, 'swipeIndex');
  },

  onTouchEnd() {
    this.setData({ isVerticalScroll: false });
  },

  // 待购列表触摸
  onTouchStartToBuy(e) {
    this._handleTouchStart(e, 'toBuySwipeIndex');
  },

  onTouchMoveToBuy(e) {
    this._handleTouchMove(e, 'toBuySwipeIndex');
  },

  onTouchEndToBuy() {
    this.setData({ isVerticalScroll: false });
  },

  // 出行列表触摸
  onTouchStartTravel(e) {
    this._handleTouchStart(e, 'travelSwipeIndex');
  },

  onTouchMoveTravel(e) {
    this._handleTouchMove(e, 'travelSwipeIndex');
  },

  onTouchEndTravel() {
    this.setData({ isVerticalScroll: false });
  },

  // 通用触摸处理
  _handleTouchStart(e, swipeKey) {
    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
      isVerticalScroll: false,
      [swipeKey]: -1
    });
  },

  _handleTouchMove(e, swipeKey) {
    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    const index = e.currentTarget.dataset.index;
    
    const deltaX = Math.abs(moveX - this.data.touchStartX);
    const deltaY = Math.abs(moveY - this.data.touchStartY);
    
    // 判断垂直滚动
    if (deltaY > deltaX && deltaY > 10) {
      this.setData({ isVerticalScroll: true });
      return;
    }
    
    if (this.data.isVerticalScroll) return;
    
    // 左滑显示操作按钮
    if (this.data.touchStartX - moveX > 50) {
      this.setData({ [swipeKey]: index });
    }
    // 右滑隐藏操作按钮
    if (moveX - this.data.touchStartX > 50) {
      this.setData({ [swipeKey]: -1 });
    }
  },

  // ==================== 年度目标模块 ====================
  fetchYearlyGoals() {
    this.setData({ loadingGoals: true });
    const { goalCurrentYear } = this.data;
    
    // 同时获取目标和年份列表
    Promise.all([
      api.get(`/YearlyGoal?year=${goalCurrentYear}`, { showLoading: false }),
      api.get('/YearlyGoal/years', { showLoading: false })
    ]).then(([goals, years]) => {
      const allGoals = goals || [];
      const goalsPig = allGoals.filter(g => g.owner === 'Pig').sort((a, b) => {
        // 未完成在前，完成在后；相同状态按优先级排序
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.priority - b.priority;
      });
      const goalsDonkey = allGoals.filter(g => g.owner === 'Donkey').sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.priority - b.priority;
      });
      
      // 处理年份列表
      const currentYear = new Date().getFullYear();
      let yearList = years || [];
      if (!yearList.includes(currentYear)) {
        yearList = [currentYear, ...yearList];
      }
      yearList = [...new Set(yearList)].sort((a, b) => b - a);
      
      // 归档年份（除当前年份外）
      const archivedYears = yearList.filter(y => y !== goalCurrentYear);
      
      this.setData({
        goalsPig,
        goalsDonkey,
        goalYearList: yearList,
        goalYearIndex: yearList.indexOf(goalCurrentYear),
        goalArchivedYears: archivedYears,
        loadingGoals: false
      });
    }).catch(() => {
      this.setData({ loadingGoals: false });
    });
  },

  // 切换年份
  onGoalYearChange(e) {
    let year;
    if (e.currentTarget.dataset.year) {
      // 从归档列表点击
      year = e.currentTarget.dataset.year;
    } else {
      // 从picker选择
      const index = e.detail.value;
      year = this.data.goalYearList[index];
    }
    
    if (year && year !== this.data.goalCurrentYear) {
      this.setData({ 
        goalCurrentYear: year,
        showGoalArchive: false
      }, () => {
        this.fetchYearlyGoals();
      });
    }
  },

  // 切换归档展开/折叠
  toggleGoalArchive() {
    this.setData({ showGoalArchive: !this.data.showGoalArchive });
  },

  // 显示新增目标表单
  showAddGoalForm(e) {
    const owner = e.currentTarget.dataset.owner;
    const currentYear = new Date().getFullYear();
    // 生成年份列表：从2020年到当前年份+2年
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

  // 显示编辑目标表单
  showEditGoalForm(id) {
    const allGoals = [...this.data.goalsPig, ...this.data.goalsDonkey];
    const item = allGoals.find(g => g.id === id);
    
    if (!item) {
      util.showError('目标不存在');
      return;
    }
    
    const currentYear = new Date().getFullYear();
    // 生成年份列表：从2020年到当前年份+2年
    const yearList = [];
    for (let y = 2020; y <= currentYear + 2; y++) {
      yearList.push(y);
    }
    // 如果目标年份不在列表中，添加进去
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

  // 隐藏目标表单
  hideGoalForm() {
    this.setData({ showGoalForm: false, editingGoalId: null });
  },

  // 目标标题输入
  onGoalTitleInput(e) {
    this.setData({ goalFormTitle: e.detail.value });
  },

  // 目标年份选择
  onGoalFormYearChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      goalFormYearIndex: index,
      goalFormYear: this.data.goalFormYearList[index]
    });
  },

  // 提交目标表单（新增或编辑）
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
      // 编辑模式
      goal.id = editingGoalId;
      api.put(`/YearlyGoal/${editingGoalId}`, goal, { loadingText: '更新中...' })
        .then(() => {
          util.showSuccess('更新成功');
          this.setData({ showGoalForm: false, goalFormTitle: '', editingGoalId: null });
          // 如果年份变了，切换到新年份
          if (goalFormYear !== this.data.goalCurrentYear) {
            this.setData({ goalCurrentYear: goalFormYear }, () => {
              this.fetchYearlyGoals();
            });
          } else {
            this.fetchYearlyGoals();
          }
        })
        .catch(() => {
          util.showError('更新失败');
        });
    } else {
      // 新增模式
      api.post('/YearlyGoal', goal, { loadingText: '添加中...' })
        .then(() => {
          util.showSuccess('添加成功');
          this.setData({ showGoalForm: false, goalFormTitle: '' });
          // 如果添加到其他年份，切换到那个年份
          if (goalFormYear !== this.data.goalCurrentYear) {
            this.setData({ goalCurrentYear: goalFormYear }, () => {
              this.fetchYearlyGoals();
            });
          } else {
            this.fetchYearlyGoals();
          }
        })
        .catch(() => {
          util.showError('添加失败');
        });
    }
  },

  // 切换目标完成状态
  toggleGoalComplete(e) {
    const id = e.currentTarget.dataset.id;
    
    // 乐观更新UI
    const updateGoalList = (list) => list.map(g => {
      if (g.id === id) {
        return Object.assign({}, g, { completed: !g.completed });
      }
      return g;
    });
    
    this.setData({
      goalsPig: updateGoalList(this.data.goalsPig),
      goalsDonkey: updateGoalList(this.data.goalsDonkey)
    });
    
    // 调用API
    api.request({
      url: `/YearlyGoal/${id}/toggle`,
      method: 'PATCH',
      showLoading: false
    }).then(() => {
      // 重新获取以保证排序正确
      this.fetchYearlyGoals();
    }).catch(() => {
      // 恢复状态
      this.setData({
        goalsPig: updateGoalList(this.data.goalsPig),
        goalsDonkey: updateGoalList(this.data.goalsDonkey)
      });
      util.showError('操作失败');
    });
  },

  // 显示目标操作菜单
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

  // 删除目标
  _deleteGoal(id) {
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
  }
});
