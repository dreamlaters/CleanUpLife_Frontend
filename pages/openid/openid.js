/**
 * OpenID 页面逻辑
 * 用于获取用户 OpenID 和管理消息推送
 */
const api = require('../../utils/api');
const util = require('../../utils/util');

Page({
  data: {
    openid: '',
    loading: true
  },

  onLoad() {
    this._getOpenid();
  },

  // ==================== 获取 OpenID ====================
  _getOpenid() {
    const app = getApp();
    // 等待登录完成后从 globalData 获取，避免重复调用登录接口
    const loginPromise = app._loginPromise || app.login();
    loginPromise.then(() => {
      this.setData({
        openid: app.globalData.openid || '未获取',
        loading: false
      });
    }).catch(() => {
      this.setData({
        openid: '获取失败',
        loading: false
      });
    });
  },

  // ==================== 消息订阅 ====================
  onRequestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: [
        'UxALkgoVSieSCdFhfkeX50yu_ORs6zMdpgmMkVMWiJY', // 物品过期提醒
        'dP6v-vSLEDMqM_mMEk3YZgCE5P7cP0NnxEJS42KfGZE'  // 经期提醒
      ],
      success: (res) => {
        const acceptCount = Object.values(res).filter(v => v === 'accept').length;
        const status = acceptCount > 0 
          ? `已授权 ${acceptCount} 个模板` 
          : '授权被拒绝';
        util.showSuccess(status);
      },
      fail: () => {
        util.showError('授权失败');
      }
    });
  }
});
