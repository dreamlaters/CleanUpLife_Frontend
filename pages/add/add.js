/**
 * 添加物品页面逻辑
 */
const api = require('../../utils/api');
const util = require('../../utils/util');
const productFormBehavior = require('../../behaviors/productFormBehavior');

Page({
  behaviors: [productFormBehavior],

  onLoad() {
    this.initToday();
  },

  // ==================== 表单提交 ====================
  submitForm() {
    if (!this._validateForm()) return;

    const { productData, categoryKey } = this._buildProductData(false);

    api.post(`/${categoryKey}`, productData, { loadingText: '提交中...' })
      .then(() => {
        util.showSuccess('添加成功');
        setTimeout(() => wx.navigateBack(), 1500);
      })
      .catch(err => {
        util.showError(err.message || '添加失败');
      });
  }
});
