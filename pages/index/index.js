// 首页逻辑处理
Page({
    data: {
        products: [], // 存储物品列表
        touchStartX: 0,
        touchMoveX: 0,
        swipeIndex: -1, // 当前左滑显示操作的行索引
        sortField: '', // 当前排序字段
        sortOrder: 'asc' // 当前排序顺序
    },
    // 页面加载时获取数据
    onLoad: function () {
        this.fetchProducts();
    },
    // 页面显示时刷新数据
    onShow: function () {
        this.fetchProducts();
    },
    // 从API获取物品列表
    fetchProducts: function () {
        wx.showLoading({
            title: '加载中...',
        });
        // 调用API获取物品列表
        wx.request({
            url: 'https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/Products',
            method: 'GET',
            success: (res) => {
                if (res.statusCode === 200) {
                    // 对每个物品格式化日期
                    const products = res.data.map(item => ({
                        ...item,
                        bestByFormatted: this.formatDate(item.bestBy)
                    }));
                    // 成功获取数据后设置到页面数据中
                    this.setData({
                        products: products
                    });
                } else {
                    // API返回错误状态码
                    wx.showToast({
                        title: '数据加载失败',
                        icon: 'error'
                    });
                }
            },
            fail: () => {
                // 网络请求失败
                wx.showToast({
                    title: '网络错误',
                    icon: 'error'
                });
            },
            complete: () => {
                wx.hideLoading();
            }
        });
    },
    goToTarget: function () {
        wx.navigateTo({
            url: '/pages/add/add'
        });
    },
    // 左滑交互
    onTouchStart: function (e) {
        this.setData({
            touchStartX: e.touches[0].clientX,
            swipeIndex: -1
        });
    },
    onTouchMove: function (e) {
        const moveX = e.touches[0].clientX;
        const index = e.currentTarget.dataset.index;
        if (this.data.touchStartX - moveX > 50) {
            this.setData({ swipeIndex: index });
        }
        if (moveX - this.data.touchStartX > 50) {
            this.setData({ swipeIndex: -1 });
        }
    },
    onTouchEnd: function (e) {
        // 保持当前swipeIndex
    },
    // 删除功能
    onDelete: function (e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认删除',
            content: '确定要删除该物品吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.request({
                        url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/Products/${id}`,
                        method: 'DELETE',
                        success: () => {
                            wx.showToast({ title: '删除成功', icon: 'success' });
                            this.fetchProducts();
                        },
                        fail: () => {
                            wx.showToast({ title: '删除失败', icon: 'error' });
                        }
                    });
                }
            }
        });
    },
    // 更新功能
    onUpdate: function (e) {
        const id = e.currentTarget.dataset.id;
        let category = e.currentTarget.dataset.category;
        if (!category) {
            category = 'Product';
        }
        wx.navigateTo({
            url: `/pages/update/update?id=${id}&category=${category}`
        });
    },
    // 点击表头排序
    onSortByName: function () {
        this.sortProducts('name');
    },
    onSortByBestBy: function () {
        this.sortProducts('bestBy');
    },
    onSortByCategory: function () {
        this.sortProducts('category');
    },
    sortProducts: function (field) {
        const { sortField, sortOrder, products } = this.data;
        const newOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
        let sortedProducts;
        if (field === 'name') {
            sortedProducts = [...products].sort((a, b) => {
                if (newOrder === 'asc') {
                    return a.name.localeCompare(b.name, 'zh');
                } else {
                    return b.name.localeCompare(a.name, 'zh');
                }
            });
        } else {
            sortedProducts = [...products].sort((a, b) => {
                if (newOrder === 'asc') {
                    return a[field] > b[field] ? 1 : -1;
                } else {
                    return a[field] < b[field] ? 1 : -1;
                }
            });
        }
        this.setData({
            products: sortedProducts,
            sortField: field,
            sortOrder: newOrder
        });
    },
    // 格式化日期显示
    formatDate: function (dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },
});