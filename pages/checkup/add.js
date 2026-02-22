/**
 * 新增/编辑体检记录页面
 * 参考范围和状态由后端自动判定，前端只提交 name + category + value
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    isEdit: false,
    checkupId: null,

    // 基础信息
    owner: 'Pig',
    owners: constants.CHECKUP_OWNERS,
    ownerConfig: constants.CHECKUP_OWNER_CONFIG,
    ownerIndex: 0,
    checkupDate: '',
    hospital: '',
    notes: '',

    // 检查项
    items: [],

    // 模板选择（从后端 metadata 加载）
    showTemplateModal: false,
    templateCategories: [],   // 分类名列表
    templateCounts: {},       // 分类 -> 项数
    selectedTemplates: {},
    metadataByCategory: {},   // 分类 -> 定义列表（缓存）

    // 分类列表
    categoryList: constants.CHECKUP_CATEGORIES,

    // 预计算：哪些分类下有项目、是否有未分类项
    categoriesWithItems: {},
    hasUncategorizedItems: false,
    
    // 编辑中的项
    editingItemIndex: -1,
    showItemForm: false,
    itemForm: {
      name: '',
      category: '',
      categoryIndex: 0,
      value: '',
      notes: ''
    },

    submitting: false
  },

  onLoad(options) {
    const now = new Date();
    this.setData({
      checkupDate: util.formatDate(now)
    });

    // 预加载 metadata
    this.loadMetadata();

    if (options.owner) {
      const idx = constants.CHECKUP_OWNERS.indexOf(options.owner);
      this.setData({
        owner: options.owner,
        ownerIndex: idx >= 0 ? idx : 0
      });
    }

    if (options.edit === 'true' && options.id) {
      this.setData({ isEdit: true, checkupId: options.id });
      this.fetchCheckup(options.id);
    }
  },

  async loadMetadata() {
    try {
      const allDefs = await api.getCheckupMetadata();
      
      // 按分类分组
      const metadataByCategory = {};
      const templateCounts = {};
      
      allDefs.forEach(def => {
        const cat = def.category;
        if (!metadataByCategory[cat]) {
          metadataByCategory[cat] = [];
        }
        metadataByCategory[cat].push(def);
      });

      // 按 sortOrder 排序
      Object.keys(metadataByCategory).forEach(cat => {
        metadataByCategory[cat].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        templateCounts[cat] = metadataByCategory[cat].length;
      });

      // 按预设分类顺序排列
      const order = constants.CHECKUP_CATEGORIES;
      const templateCategories = Object.keys(metadataByCategory).sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      this.setData({ metadataByCategory, templateCounts, templateCategories });
    } catch (err) {
      console.error('加载检查项定义失败', err);
      // 降级：使用本地计数
      this.setData({
        templateCategories: constants.CHECKUP_CATEGORIES,
        templateCounts: constants.CHECKUP_TEMPLATE_COUNTS
      });
    }
  },

  async fetchCheckup(id) {
    try {
      wx.showLoading({ title: '加载中...' });
      const checkup = await api.getCheckupById(id);
      
      const ownerIdx = constants.CHECKUP_OWNERS.indexOf(checkup.owner);
      
      this.setData({
        owner: checkup.owner,
        ownerIndex: ownerIdx >= 0 ? ownerIdx : 0,
        checkupDate: checkup.checkupDate ? checkup.checkupDate.split('T')[0] : '',
        hospital: checkup.hospital || '',
        notes: checkup.notes || '',
        items: (checkup.items || []).map((item, idx) => ({
          ...item,
          _index: idx,
          categoryIndex: constants.CHECKUP_CATEGORIES.indexOf(item.category),
          isComputed: item.name === 'BMI'
        }))
      });
      this.updateItemsMetadata();
      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      console.error('获取体检记录失败', err);
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  // 预计算 WXML 需要的分类标记（WXML 不支持 .filter / .includes）
  updateItemsMetadata() {
    const { items, categoryList } = this.data;
    const catSet = new Set(categoryList);
    const categoriesWithItems = {};
    let hasUncategorizedItems = false;

    items.forEach((item, idx) => {
      if (catSet.has(item.category)) {
        categoriesWithItems[item.category] = true;
      } else {
        hasUncategorizedItems = true;
        items[idx] = { ...item, _uncategorized: true };
      }
    });

    this.setData({ categoriesWithItems, hasUncategorizedItems, items });
  },

  // ==================== 基础信息 ====================
  onOwnerChange(e) {
    const idx = e.detail.value;
    this.setData({
      ownerIndex: idx,
      owner: constants.CHECKUP_OWNERS[idx]
    });
  },

  onDateChange(e) {
    this.setData({ checkupDate: e.detail.value });
  },

  onHospitalInput(e) {
    this.setData({ hospital: e.detail.value });
  },

  onNotesInput(e) {
    this.setData({ notes: e.detail.value });
  },

  // ==================== 模板快速填充 ====================
  showTemplates() {
    this.setData({
      showTemplateModal: true,
      selectedTemplates: {}
    });
  },

  hideTemplateModal() {
    this.setData({ showTemplateModal: false });
  },

  toggleTemplate(e) {
    const { category } = e.currentTarget.dataset;
    const key = `selectedTemplates.${category}`;
    this.setData({
      [key]: !this.data.selectedTemplates[category]
    });
  },

  applyTemplates() {
    const { selectedTemplates, items, metadataByCategory } = this.data;
    const existingNames = new Set(items.map(i => i.name));
    let newItems = [...items];

    Object.keys(selectedTemplates).forEach(category => {
      if (!selectedTemplates[category]) return;
      
      const defs = metadataByCategory[category] || [];
      defs.forEach(def => {
        if (!existingNames.has(def.name)) {
          newItems.push({
            name: def.name,
            category: def.category,
            value: '',
            categoryIndex: constants.CHECKUP_CATEGORIES.indexOf(def.category),
            notes: '',
            isComputed: def.isComputed || false
          });
          existingNames.add(def.name);
        }
      });
    });

    this.setData({
      items: newItems,
      showTemplateModal: false
    });
    this.updateItemsMetadata();

    if (newItems.length > items.length) {
      wx.showToast({ title: `已添加${newItems.length - items.length}项`, icon: 'success' });
    }
  },

  // ==================== 检查项操作 ====================
  showAddItem() {
    this.setData({
      showItemForm: true,
      editingItemIndex: -1,
      itemForm: {
        name: '',
        category: '',
        categoryIndex: 0,
        value: '',
        notes: ''
      }
    });
  },

  showEditItem(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.items[index];
    
    this.setData({
      showItemForm: true,
      editingItemIndex: index,
      itemForm: {
        name: item.name || '',
        category: item.category || '',
        categoryIndex: constants.CHECKUP_CATEGORIES.indexOf(item.category) >= 0
          ? constants.CHECKUP_CATEGORIES.indexOf(item.category) : 0,
        value: item.value || '',
        notes: item.notes || ''
      }
    });
  },

  hideItemForm() {
    this.setData({ showItemForm: false, editingItemIndex: -1 });
  },

  onItemNameInput(e) {
    this.setData({ 'itemForm.name': e.detail.value });
  },

  onItemCategoryChange(e) {
    const idx = e.detail.value;
    this.setData({
      'itemForm.categoryIndex': idx,
      'itemForm.category': constants.CHECKUP_CATEGORIES[idx]
    });
  },

  onItemValueInput(e) {
    this.setData({ 'itemForm.value': e.detail.value });
  },

  onItemNotesInput(e) {
    this.setData({ 'itemForm.notes': e.detail.value });
  },

  saveItem() {
    const { itemForm, editingItemIndex, items } = this.data;

    if (!itemForm.name.trim()) {
      wx.showToast({ title: '请输入项目名', icon: 'error' });
      return;
    }

    const newItem = {
      name: itemForm.name.trim(),
      category: itemForm.category || constants.CHECKUP_CATEGORIES[itemForm.categoryIndex],
      value: itemForm.value,
      categoryIndex: itemForm.categoryIndex,
      notes: itemForm.notes
    };

    let newItems = [...items];
    if (editingItemIndex >= 0) {
      newItem.id = items[editingItemIndex].id;
      newItems[editingItemIndex] = newItem;
    } else {
      newItems.push(newItem);
    }

    this.setData({
      items: newItems,
      showItemForm: false,
      editingItemIndex: -1
    });
    this.updateItemsMetadata();
  },

  deleteItem(e) {
    const { index } = e.currentTarget.dataset;
    
    wx.showModal({
      title: '确认删除',
      content: `确定删除 "${this.data.items[index].name}" 吗？`,
      success: (res) => {
        if (res.confirm) {
          const items = [...this.data.items];
          items.splice(index, 1);
          this.setData({ items });
          this.updateItemsMetadata();
        }
      }
    });
  },

  // 快速编辑值 — 直接在列表中修改
  onQuickValueInput(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      [`items[${index}].value`]: e.detail.value
    });
    // 身高或体重变化时自动计算 BMI
    const item = this.data.items[index];
    if (item.name === '身高' || item.name === '体重') {
      this.computeBmi();
    }
  },

  // 自动计算 BMI = 体重(kg) / (身高(m))²
  computeBmi() {
    const { items } = this.data;
    const heightItem = items.find(i => i.name === '身高');
    const weightItem = items.find(i => i.name === '体重');
    const bmiIdx = items.findIndex(i => i.name === 'BMI');

    if (!heightItem || !weightItem || bmiIdx < 0) return;

    const h = parseFloat(heightItem.value);
    const w = parseFloat(weightItem.value);

    if (h > 0 && w > 0) {
      const hm = h / 100;
      const bmi = (w / (hm * hm)).toFixed(1);
      this.setData({ [`items[${bmiIdx}].value`]: bmi });
    } else {
      this.setData({ [`items[${bmiIdx}].value`]: '' });
    }
  },

  // ==================== 提交 ====================
  async submitForm() {
    const { isEdit, checkupId, owner, checkupDate, hospital, notes, items, submitting } = this.data;

    if (submitting) return;

    if (!checkupDate) {
      wx.showToast({ title: '请选择体检日期', icon: 'error' });
      return;
    }

    if (items.length === 0) {
      wx.showToast({ title: '请至少添加一项检查', icon: 'error' });
      return;
    }

    // 检查是否所有项都填了值
    const emptyItems = items.filter(i => !i.value);
    if (emptyItems.length > 0) {
      wx.showModal({
        title: '有未填写的项目',
        content: `${emptyItems.length}个项目未填写结果值，确认提交吗？`,
        success: (res) => {
          if (res.confirm) {
            this.doSubmit();
          }
        }
      });
      return;
    }

    this.doSubmit();
  },

  async doSubmit() {
    const { isEdit, checkupId, owner, checkupDate, hospital, notes, items } = this.data;
    
    this.setData({ submitting: true });

    // 前端只提交 name + category + value + notes，后端自动填充 unit/referenceRange/status
    const data = {
      owner,
      checkupDate,
      hospital: hospital || null,
      notes: notes || null,
      items: items.map(item => ({
        id: item.id || undefined,
        name: item.name,
        category: item.category,
        value: item.value || '',
        notes: item.notes || null
      }))
    };

    try {
      if (isEdit) {
        await api.updateCheckup(checkupId, data, { loadingText: '更新中...' });
        wx.showToast({ title: '更新成功', icon: 'success' });
      } else {
        await api.createCheckup(data, { loadingText: '保存中...' });
        wx.showToast({ title: '保存成功', icon: 'success' });
      }

      setTimeout(() => {
        wx.navigateBack();
      }, 500);
    } catch (err) {
      console.error('保存失败', err);
      wx.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  stopPropagation() {}
});
