/**
 * 更新物品页面逻辑
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const productFormBehavior = require('../../behaviors/productFormBehavior');

Page({
  behaviors: [productFormBehavior],

  data: {
    id: null,
    category: 'Product'
  },

  onLoad(options) {
    this.initToday();
    
    if (options.id) {
      const category = options.category || 'Product';
      this.setData({ id: options.id, category });
      this._fetchProduct(options.id, category);
    }
  },

  // ==================== 数据获取 ====================
  _fetchProduct(id, category) {
    const endpoint = category === 'Product' ? 'Products' : category;
    
    api.get(`/${endpoint}/${id}`, { loadingText: '加载中...' })
      .then(item => {
        this._fillFormData(item);
      })
      .catch(() => {
        util.showError('加载失败');
      });
  },

  // ==================== 表单提交 ====================
  updateForm() {
    if (!this._validateForm()) return;

    const { productData, categoryKey } = this._buildProductData(true);

    api.put(`/${categoryKey}/${this.data.id}`, productData, { loadingText: '更新中...' })
      .then(() => {
        util.showSuccess('更新成功');
        setTimeout(() => wx.navigateBack(), 1500);
      })
      .catch(() => {
        util.showError('更新失败');
      });
  }
});
