/**
 * CleanUpLife 小程序入口文件
 */
const util = require('./utils/util');
const api = require('./utils/api');
const constants = require('./utils/constants');

App({
  onLaunch() {
    // 应用启动时的初始化逻辑
    console.log('CleanUpLife 小程序启动');
  },

  // 全局工具方法和配置
  globalData: {
    util,
    api,
    constants
  }
});

