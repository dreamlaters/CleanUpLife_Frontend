/**
 * 体检详情页面
 */
const api = require('../../utils/api');
const constants = require('../../utils/constants');

Page({
  data: {
    checkup: null,
    loading: true,
    groupedItems: [],
    expandedCategories: {},
    ownerConfig: constants.CHECKUP_OWNER_CONFIG,
    statusMap: constants.CHECKUP_STATUS
  },

  onLoad(options) {
    if (options.id) {
      this.fetchCheckup(options.id);
    }
  },

  async fetchCheckup(id) {
    this.setData({ loading: true });
    try {
      const checkup = await api.getCheckupById(id);
      
      // 按分类分组
      const categoryMap = {};
      (checkup.items || []).forEach(item => {
        const cat = item.category || '其他';
        if (!categoryMap[cat]) {
          categoryMap[cat] = { category: cat, items: [], abnormalCount: 0 };
        }
        categoryMap[cat].items.push(item);
        if (item.status !== 'Normal') {
          categoryMap[cat].abnormalCount++;
        }
      });

      // 按预设分类顺序排列
      const order = constants.CHECKUP_CATEGORIES;
      const groupedItems = Object.values(categoryMap).sort((a, b) => {
        const ia = order.indexOf(a.category);
        const ib = order.indexOf(b.category);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      // 默认展开所有分类
      const expandedCategories = {};
      groupedItems.forEach(g => {
        expandedCategories[g.category] = true;
      });

      this.setData({
        checkup: {
          ...checkup,
          checkupDateFormatted: checkup.checkupDate ? checkup.checkupDate.split('T')[0] : '',
          abnormalCount: (checkup.items || []).filter(i => i.status !== 'Normal').length,
          normalCount: (checkup.items || []).filter(i => i.status === 'Normal').length
        },
        groupedItems,
        expandedCategories,
        loading: false
      });
    } catch (err) {
      console.error('获取体检详情失败', err);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  toggleCategory(e) {
    const { category } = e.currentTarget.dataset;
    const key = `expandedCategories.${category}`;
    this.setData({
      [key]: !this.data.expandedCategories[category]
    });
  },

  goToEdit() {
    if (this.data.checkup) {
      wx.navigateTo({ url: `/pages/checkup/add?id=${this.data.checkup.id}&edit=true` });
    }
  },

  deleteCheckup() {
    if (!this.data.checkup) return;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条体检记录吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.deleteCheckup(this.data.checkup.id, { loadingText: '删除中...' });
            wx.showToast({ title: '删除成功', icon: 'success' });
            setTimeout(() => {
              wx.navigateBack();
            }, 500);
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  },

  onShow() {
    // 从编辑页返回时刷新数据
    if (this.data.checkup) {
      this.fetchCheckup(this.data.checkup.id);
    }
  }
});
