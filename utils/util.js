/**
 * 工具函数模块
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {string|Date} dateInput 日期字符串或 Date 对象
 * @returns {string} 格式化后的日期字符串
 */
const formatDate = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 格式化日期为 YYYY-MM 格式（年月）
 * @param {string|Date} dateInput 日期字符串或 Date 对象
 * @returns {string} 格式化后的年月字符串
 */
const formatYearMonth = (dateInput) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * 获取今天的日期字符串
 * @returns {string} 今天的日期 YYYY-MM-DD
 */
const getTodayString = () => {
  return formatDate(new Date());
};

/**
 * 计算日期与今天的天数差
 * @param {string|Date} dateInput 目标日期
 * @returns {number} 天数差（正数表示未来，负数表示过去）
 */
const getDaysDiff = (dateInput) => {
  if (!dateInput) return Infinity;
  const targetDate = new Date(dateInput);
  const today = new Date();
  // 清除时间部分，按天比较
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffMs = target - todayDate;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * 根据保质期日期获取样式类名
 * @param {string|Date} bestBy 保质期日期
 * @returns {string} 样式类名
 */
const getDateClass = (bestBy) => {
  const diffDays = getDaysDiff(bestBy);
  if (diffDays < 0) {
    return 'date-expired';  // 已过期
  } else if (diffDays <= 30) {
    return 'date-soon';     // 即将过期
  }
  return 'date-normal';     // 正常
};

/**
 * 防抖函数
 * @param {Function} fn 需要防抖的函数
 * @param {number} delay 延迟时间(ms)
 * @returns {Function} 防抖后的函数
 */
const debounce = (fn, delay = 300) => {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
};

/**
 * 显示确认对话框
 * @param {string} title 标题
 * @param {string} content 内容
 * @returns {Promise<boolean>} 用户是否确认
 */
const showConfirm = (title, content) => {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      success: (res) => {
        resolve(res.confirm);
      },
      fail: () => {
        resolve(false);
      }
    });
  });
};

/**
 * 成功提示
 * @param {string} title 提示文本
 */
const showSuccess = (title) => {
  wx.showToast({ title, icon: 'success' });
};

/**
 * 错误提示
 * @param {string} title 提示文本
 */
const showError = (title) => {
  wx.showToast({ title, icon: 'error' });
};

module.exports = {
  formatDate,
  formatYearMonth,
  getTodayString,
  getDaysDiff,
  getDateClass,
  debounce,
  showConfirm,
  showSuccess,
  showError
};
