Page({
  data: {
    id: null,
    formData: { name: '', priority: 0, description: '' }
  },
  onLoad: function(options) {
    if (options.id) {
      this.setData({ id: options.id });
      this.fetchToBuy(options.id);
    }
  },
  fetchToBuy: function(id) {
    wx.showLoading({ title: '加载中...' });
    wx.request({
      url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/ToBuy/${id}`,
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200) {
          const item = res.data;
          this.setData({ formData: { name: item.name ?? item.Name ?? '', priority: item.priority ?? item.Priority ?? 0, description: item.description ?? item.Description ?? '' } });
        } else {
          wx.showToast({ title: '加载失败', icon: 'error' });
        }
      },
      fail: () => { wx.showToast({ title: '网络错误', icon: 'error' }); },
      complete: () => { wx.hideLoading(); }
    });
  },
  onNameInput: function(e) { this.setData({ 'formData.name': e.detail.value }); },
  onPriorityInput: function(e) { this.setData({ 'formData.priority': Number(e.detail.value) }); },
  onDescriptionInput: function(e) { this.setData({ 'formData.description': e.detail.value }); },
  submitForm: function() {
    if (!this.data.formData.name) { wx.showToast({ title: '物品名称不能为空', icon: 'error' }); return; }
    const data = { id: this.data.id, Name: this.data.formData.name, Priority: this.data.formData.priority, Description: this.data.formData.description || '' };
    wx.showLoading({ title: '更新中...' });
    wx.request({
      url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/ToBuy/${this.data.id}`,
      method: 'PUT',
      data: data,
      header: { 'content-type': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200) {
          wx.showToast({ title: '更新成功', icon: 'success' });
          setTimeout(() => { wx.navigateBack(); }, 1000);
        } else {
          wx.showToast({ title: '更新失败', icon: 'error' });
        }
      },
      fail: () => { wx.showToast({ title: '网络错误', icon: 'error' }); },
      complete: () => { wx.hideLoading(); }
    });
  }
});