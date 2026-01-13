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
    wx.login({
      success: (res) => {
        if (res.code) {
          this._fetchOpenid(res.code);
        } else {
          this.setData({ 
            openid: '获取登录凭证失败',
            loading: false 
          });
        }
      },
      fail: () => {
        this.setData({ 
          openid: 'wx.login失败',
          loading: false 
        });
      }
    });
  },

  _fetchOpenid(code) {
    wx.request({
      url: `${api.BASE_URL}/OpenId/wechat`,
      method: 'POST',
      data: { Code: code },
      success: (resp) => {
        let openid = '';
        if (resp.data?.openid) {
          openid = resp.data.openid;
        } else if (typeof resp.data === 'string') {
          try {
            // 兼容处理特殊格式响应
            const parsed = JSON.parse(resp.data.toString().substr(18));
            openid = parsed.openid;
          } catch (e) {
            openid = '解析响应失败';
          }
        }
        this.setData({ openid, loading: false });
      },
      fail: () => {
        this.setData({ 
          openid: '请求失败',
          loading: false 
        });
      }
    });
  },

  // ==================== 消息订阅 ====================
  onRequestSubscribe() {
    wx.requestSubscribeMessage({
      tmplIds: ['UxALkgoVSieSCdFhfkeX50yu_ORs6zMdpgmMkVMWiJY'],
      success: (res) => {
        const status = Object.values(res).find(v => v === 'accept') 
          ? '已授权' 
          : '授权被拒绝';
        util.showSuccess(status);
      },
      fail: () => {
        util.showError('授权失败');
      }
    });
  }
});
