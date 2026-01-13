/**
 * 更新待购物品页面逻辑
 */
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    id: null,
    formData: {
      name: '',
      priority: 1,
      description: ''
    }
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this._fetchToBuy(options.id);
    }
  },

  // ==================== 数据获取 ====================
  _fetchToBuy(id) {
    api.get(`/ToBuy/${id}`, { loadingText: '加载中...' })
      .then(item => {
        this.setData({
          formData: {
            name: item.name ?? item.Name ?? '',
            priority: item.priority ?? item.Priority ?? 1,
            description: item.description ?? item.Description ?? ''
          }
        });
      })
      .catch(() => {
        util.showError('加载失败');
      });
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
      id: this.data.id,
      Name: this.data.formData.name,
      Priority: this.data.formData.priority,
      Description: this.data.formData.description || ''
    };

    api.put(`/ToBuy/${this.data.id}`, data, { loadingText: '更新中...' })
      .then(() => {
        util.showSuccess('更新成功');
        setTimeout(() => wx.navigateBack(), 1000);
      })
      .catch(() => {
        util.showError('更新失败');
      });
  }
});
