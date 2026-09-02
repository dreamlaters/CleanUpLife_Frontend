Page({
  onLoad(options) {
    const app = getApp();
    app.globalData = app.globalData || {};
    const requestedTab = options.tab || app.globalData.targetTab || 'weight';
    app.globalData.targetTab = null;

    if (requestedTab === 'period' || requestedTab === 'checkup') {
      app.globalData.targetHealthTab = requestedTab;
      wx.switchTab({ url: '/pages/health/health' });
      return;
    }

    app.globalData.targetCatTab = requestedTab === 'play' ? 'play' : 'weight';
    wx.switchTab({ url: '/pages/cat/cat' });
  }
});
