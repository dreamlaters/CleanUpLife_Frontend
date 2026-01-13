/**
 * 添加物品页面逻辑
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const constants = require('../../utils/constants');

Page({
  data: {
    formData: {
      name: '',
      description: '',
      bestBy: '',
      location: {
        site: '',
        roomPlacement: ''
      },
      // 特有字段
      storeOption: '',
      proteinPercentage: '',
      weight: '',
      weightUnit: '',
      flavor: '',
      effect: ''
    },
    today: '',
    
    // 选项数据
    locationRooms: constants.LOCATION_ROOMS,
    locationSites: constants.LOCATION_SITES,
    categories: constants.CATEGORIES,
    storages: constants.STORAGES,
    weightUnits: constants.WEIGHT_UNITS,
    
    // 选中索引
    locationRoomIndex: null,
    locationSiteIndex: null,
    categoryIndex: null,
    storageIndex: null,
    weightUnitIndex: null
  },

  onLoad() {
    this.setData({ today: util.getTodayString() });
  },

  // ==================== 表单输入处理 ====================
  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  onDescriptionInput(e) {
    this.setData({ 'formData.description': e.detail.value });
  },

  onDateChange(e) {
    this.setData({ 'formData.bestBy': e.detail.value });
  },

  onLocationRoomChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      locationRoomIndex: index,
      'formData.location.roomPlacement': this.data.locationRooms[index]
    });
  },

  onLocationSiteChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      locationSiteIndex: index,
      'formData.location.site': this.data.locationSites[index]
    });
  },

  onCategoryChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({ categoryIndex: index });
  },

  onStorageChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      storageIndex: index,
      'formData.storeOption': this.data.storages[index]
    });
  },

  onProteinInput(e) {
    this.setData({ 'formData.proteinPercentage': e.detail.value });
  },

  onWeightInput(e) {
    this.setData({ 'formData.weight': e.detail.value });
  },

  onWeightUnitChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      weightUnitIndex: index,
      'formData.weightUnit': this.data.weightUnits[index]
    });
  },

  onFlavorInput(e) {
    this.setData({ 'formData.flavor': e.detail.value });
  },

  onEffectInput(e) {
    this.setData({ 'formData.effect': e.detail.value });
  },

  // ==================== 表单提交 ====================
  submitForm() {
    // 表单验证
    if (!this._validateForm()) return;

    const category = this.data.categories[this.data.categoryIndex];
    const categoryKey = constants.CATEGORY_MAP[category] || 'Product';

    // 构建提交数据
    const productData = {
      name: this.data.formData.name,
      description: this.data.formData.description || '',
      bestBy: this.data.formData.bestBy + 'T00:00:00Z',
      location: {
        site: this.data.formData.location.site,
        roomPlacement: this.data.formData.location.roomPlacement || ''
      },
      category: categoryKey
    };

    // 添加特有字段
    this._addCategorySpecificFields(productData, category);

    // 提交数据
    api.post(`/${categoryKey}`, productData, { loadingText: '提交中...' })
      .then(() => {
        util.showSuccess('添加成功');
        setTimeout(() => wx.navigateBack(), 1500);
      })
      .catch(err => {
        util.showError(err.message || '添加失败');
      });
  },

  // ==================== 私有方法 ====================
  _validateForm() {
    const { formData, categoryIndex, storageIndex, weightUnitIndex, categories } = this.data;

    if (!formData.name) {
      util.showError('物品名称不能为空');
      return false;
    }

    if (!formData.bestBy) {
      util.showError('请选择保质期到期日');
      return false;
    }

    if (!formData.location.site) {
      util.showError('请选择存放位置');
      return false;
    }

    if (categoryIndex === null) {
      util.showError('请选择物品种类');
      return false;
    }

    const category = categories[categoryIndex];

    if (category === '食物' && storageIndex === null) {
      util.showError('请选择存储条件');
      return false;
    }

    if (category === '猫粮') {
      if (!formData.proteinPercentage || !formData.weight || 
          weightUnitIndex === null || !formData.flavor) {
        util.showError('请填写猫粮所有特有字段');
        return false;
      }
    }

    if (category === '药品' && !formData.effect) {
      util.showError('请填写药品功效');
      return false;
    }

    return true;
  },

  _addCategorySpecificFields(data, category) {
    const { formData } = this.data;
    
    if (category === '食物') {
      data.storeOption = formData.storeOption;
    } else if (category === '猫粮') {
      data.proteinPercentage = formData.proteinPercentage;
      data.weight = formData.weight;
      data.weightUnit = formData.weightUnit;
      data.flavor = formData.flavor;
    } else if (category === '药品') {
      data.effect = formData.effect;
    }
  }
});
