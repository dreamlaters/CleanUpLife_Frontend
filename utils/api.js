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
  const app = getApp();

  // 确保登录完成后再发请求（跳过登录接口本身）
  const loginReady = (options.skipAuth || options.url === '/OpenId/wechat')
    ? Promise.resolve()
    : (app._loginPromise || app.login());

  return loginReady.then(() => {
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
          'content-type': 'application/json',
          'X-Auth-Token': app.globalData.token || ''
        },
        success: (res) => {
          if (res.statusCode === 401) {
            // token 过期或无效，重新登录后重试（最多重试3次）
            const retryCount = options._retryCount || 0;
            if (retryCount >= 3) {
              reject(new Error('认证失败，请重新打开小程序'));
              return;
            }
            console.warn('Token 无效，正在重新登录...');
            app._loginPromise = null;
            app.login().then(() => {
              request({ ...options, _retryCount: retryCount + 1 }).then(resolve).catch(reject);
            }).catch((err) => {
              reject(err);
            });
            return;
          }
          if (res.statusCode === 403) {
            wx.redirectTo({ url: '/pages/blocked/blocked' });
            reject(new Error('无权限访问'));
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else if (res.statusCode === 409) {
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
  return get('/Travel/status/Pending', { showLoading: false, ...options }).then(data => ({ data }));
};

// ==================== 姨妈记录 API ====================

/**
 * 获取姨妈记录列表
 */
const getPeriodList = (options = {}) => {
  return get('/Period/list', { showLoading: false, ...options }).then(data => ({ data }));
};

/**
 * 获取姨妈统计信息
 */
const getPeriodStats = (options = {}) => {
  return get('/Period/stats', { showLoading: false, ...options });
};

/**
 * 获取最新姨妈记录
 */
const getLatestPeriod = (options = {}) => {
  return get('/Period/latest', { showLoading: false, ...options });
};

/**
 * 记录姨妈开始
 */
const recordPeriodStart = (startDate, notes = '', options = {}) => {
  return post('/Period/start', { startDate, notes }, options);
};

/**
 * 记录姨妈结束
 */
const recordPeriodEnd = (id, endDate, options = {}) => {
  return post(`/Period/${id}/end`, { endDate }, options);
};

/**
 * 更新姨妈记录
 */
const updatePeriod = (id, data, options = {}) => {
  return put(`/Period/${id}`, data, options);
};

/**
 * 删除姨妈记录
 */
const deletePeriod = (id, options = {}) => {
  return del(`/Period/${id}`, options);
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
  getPendingTravelList,
  // 姨妈记录
  getPeriodList,
  getPeriodStats,
  getLatestPeriod,
  recordPeriodStart,
  recordPeriodEnd,
  updatePeriod,
  deletePeriod
};
