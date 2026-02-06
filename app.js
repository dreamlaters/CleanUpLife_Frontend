/**
 * CleanUpLife 小程序入口文件
 */
const util = require('./utils/util');
const api = require('./utils/api');
const constants = require('./utils/constants');

// 缓存系统信息，避免多次同步调用
let cachedSystemInfo = null;

App({
  onLaunch() {
    // 应用启动时的初始化逻辑
    console.log('CleanUpLife 小程序启动');
    // 预加载系统信息
    this.getSystemInfo();
    // 登录获取 token
    this.login();
  },

  /**
   * 登录流程：wx.login 获取 code → 后端换 openid + token
   * 返回 Promise，其他页面可以 await 等待登录完成
   */
  login() {
    if (this._loginPromise) return this._loginPromise;

    this._loginPromise = new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (!res.code) {
            console.error('wx.login 获取 code 失败');
            reject(new Error('获取登录凭证失败'));
            return;
          }
          wx.request({
            url: `${api.BASE_URL}/OpenId/wechat`,
            method: 'POST',
            data: { Code: res.code },
            header: { 'content-type': 'application/json' },
            success: (resp) => {
              if (resp.statusCode === 403) {
                // 不在白名单
                console.warn('访问被拒绝');
                this.globalData.blocked = true;
                this.globalData.blockedInfo = resp.data;
                wx.redirectTo({ url: '/pages/blocked/blocked' });
                reject(new Error('不在白名单'));
                return;
              }
              if (resp.statusCode >= 200 && resp.statusCode < 300 && resp.data?.token) {
                this.globalData.token = resp.data.token;
                this.globalData.openid = resp.data.openid;
                console.log('登录成功，token 已获取');
                resolve(resp.data);
              } else {
                console.error('登录接口异常', resp);
                reject(new Error('登录失败'));
              }
            },
            fail: (err) => {
              console.error('登录请求失败', err);
              reject(err);
            }
          });
        },
        fail: (err) => {
          console.error('wx.login 失败', err);
          reject(err);
        }
      });
    });

    // 登录失败后允许重试
    this._loginPromise.catch(() => {
      this._loginPromise = null;
    });

    return this._loginPromise;
  },

  // 获取系统信息（带缓存）
  getSystemInfo() {
    if (!cachedSystemInfo) {
      try {
        cachedSystemInfo = wx.getSystemInfoSync();
      } catch (e) {
        console.error('获取系统信息失败', e);
        cachedSystemInfo = { statusBarHeight: 20, pixelRatio: 2 };
      }
    }
    return cachedSystemInfo;
  },

  // 全局工具方法和配置
  globalData: {
    util,
    api,
    constants,
    token: null,
    openid: null,
    blocked: false,
    blockedInfo: null
  }
});

