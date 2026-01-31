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
    constants
  }
});

