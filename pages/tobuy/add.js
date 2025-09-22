Page({
  data: {
    formData: {
      name: '',
      priority: 0,
      description: ''
    }
  },
  onNameInput: function (e) {
    this.setData({ 'formData.name': e.detail.value });
  },
  onPriorityInput: function (e) {
    this.setData({ 'formData.priority': Number(e.detail.value) });
  },
  onDescriptionInput: function (e) {
    this.setData({ 'formData.description': e.detail.value });
  },
  submitForm: function () {
    if (!this.data.formData.name) {
      wx.showToast({ title: '物品名称不能为空', icon: 'error' });
      return;
    }
    const data = {
      id: undefined,
      Name: this.data.formData.name,
      Priority: this.data.formData.priority,
      Description: this.data.formData.description || ''
    };
    wx.showLoading({ title: '提交中...' });
    wx.request({
      url: 'https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/ToBuy',
      method: 'POST',
      data: data,
      header: { 'content-type': 'application/json' },
      success: (res) => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          wx.showToast({ title: '新增成功', icon: 'success' });
          setTimeout(() => { wx.navigateBack(); }, 1000);
        } else {
          wx.showToast({ title: '新增失败', icon: 'error' });
        }
      },
      fail: () => { wx.showToast({ title: '网络错误', icon: 'error' }); },
      complete: () => { wx.hideLoading(); }
    });
  }
});