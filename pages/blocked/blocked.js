/**
 * 访问受限页面
 * 当用户 openid 不在白名单时显示
 */
Page({
  data: {
    message: ''
  },

  onLoad() {
    const app = getApp();
    const blockedInfo = app.globalData.blockedInfo || {};
    this.setData({
      message: blockedInfo.message || '抱歉，您的 OpenID 或者 IP 地址不在白名单中'
    });
  }
});
