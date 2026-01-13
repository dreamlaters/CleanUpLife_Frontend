/**
 * 新增待购物品页面逻辑 - 现代化UI
 */
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    formData: {
      name: '',
      priority: 5,
      description: ''
    }
  },

  // ==================== 表单输入处理 ====================
  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value });
  },

  onPriorityChange(e) {
    this.setData({ 'formData.priority': e.detail.value });
  },

  onDescriptionInput(e) {
    this.setData({ 'formData.description': e.detail.value });
  },

  // ==================== 表单提交 ====================
  submitForm() {
    if (!this.data.formData.name) {
      util.showError('物品名称不能为空');
      return;
    }

    const data = {
      id: undefined,
      Name: this.data.formData.name,
      Priority: this.data.formData.priority,
      Description: this.data.formData.description || ''
    };

    api.post('/ToBuy', data, { loadingText: '提交中...' })
      .then(() => {
        util.showSuccess('添加成功');
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(() => {
        util.showError('添加失败');
      });
  }
});
