/**
 * API 请求封装模块
 * 统一处理网络请求、错误处理和 loading 状态
 */

const BASE_URL = 'https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net';

/**
 * 发起 HTTP 请求
 * @param {Object} options 请求配置
 * @param {string} options.url 请求路径 (不含 BASE_URL)
 * @param {string} options.method 请求方法 GET/POST/PUT/DELETE
 * @param {Object} options.data 请求数据
 * @param {boolean} options.showLoading 是否显示 loading，默认 true
 * @param {string} options.loadingText loading 文本，默认 '加载中...'
 * @returns {Promise} 返回 Promise
 */
const request = (options) => {
  return new Promise((resolve, reject) => {
    const {
      url,
      method = 'GET',
      data = {},
      showLoading = true,
      loadingText = '加载中...'
    } = options;

    if (showLoading) {
      wx.showLoading({ title: loadingText });
    }

    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 409) {
          // 冲突响应，返回完整信息供调用方处理
          const error = new Error(res.data?.message || '发现重复记录');
          error.statusCode = 409;
          error.data = res.data;
          reject(error);
        } else {
          const errorMsg = res.data?.message || '请求失败';
          wx.showToast({ title: errorMsg, icon: 'error' });
          reject(new Error(errorMsg));
        }
      },
      fail: (err) => {
        wx.showToast({ title: '网络错误', icon: 'error' });
        reject(err);
      },
      complete: () => {
        if (showLoading) {
          wx.hideLoading();
        }
      }
    });
  });
};

/**
 * GET 请求
 */
const get = (url, options = {}) => {
  return request({ url, method: 'GET', ...options });
};

/**
 * POST 请求
 */
const post = (url, data, options = {}) => {
  return request({ url, method: 'POST', data, ...options });
};

/**
 * PUT 请求
 */
const put = (url, data, options = {}) => {
  return request({ url, method: 'PUT', data, ...options });
};

/**
 * DELETE 请求
 */
const del = (url, options = {}) => {
  return request({ url, method: 'DELETE', data: options.data, ...options });
};

// ==================== 业务 API ====================

/**
 * 获取物品列表
 */
const getProductList = (options = {}) => {
  return get('/Products', { showLoading: false, ...options }).then(data => ({ data }));
};

/**
 * 获取待购列表
 */
const getToBuyList = (options = {}) => {
  return get('/ToBuy', { showLoading: false, ...options }).then(data => ({ data }));
};

/**
 * 获取出行列表
 */
const getTravelList = (options = {}) => {
  return get('/Travel', { showLoading: false, ...options }).then(data => ({ data }));
};

/**
 * 获取想去的地方列表（pending状态）
 */
const getPendingTravelList = (options = {}) => {
  return get('/Travel/status/0', { showLoading: false, ...options }).then(data => ({ data }));
};

module.exports = {
  BASE_URL,
  request,
  get,
  post,
  put,
  del,
  getProductList,
  getToBuyList,
  getTravelList,
  getPendingTravelList
};
