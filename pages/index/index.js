// 首页逻辑处理
Page({
    data: {
        products: [], // 存储物品列表
        toBuyProducts: [], // 存储待购物品
        touchStartX: 0,
        touchStartY: 0, // 添加Y坐标记录
        touchMoveX: 0,
        touchMoveY: 0, // 添加Y坐标记录
        swipeIndex: -1, // 当前左滑显示操作的行索引
        toBuySwipeIndex: -1, // 待购物品左滑索引
        sortField: '', // 当前排序字段
        sortOrder: 'asc', // 当前排序顺序
        isVerticalScroll: false, // 标记是否为垂直滚动
        // 出行模块数据
        travelTab: 'pending', // 当前tab: pending/visited
        travelList: [], // 当前显示的出行列表
        travelSwipeIndex: -1, // 出行列表左滑索引
        showTravelForm: false, // 是否显示新增表单
        travelFormTypeIndex: 0, // 0: 国内, 1: 国外
        travelFormName: '', // 目的地名称
        travelFormPriority: 1, // 优先级
        // 国内省市区
        provinceList: ['北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南', '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '台湾', '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门'],
        cityList: [],
        districtList: [],
        travelProvinceIndex: 0,
        travelCityIndex: 0,
        travelDistrictIndex: 0,
        // 国外国家
        countryList: ['日本', '韩国', '美国', '英国', '法国', '德国', '意大利', '西班牙', '葡萄牙', '荷兰', '比利时', '瑞士', '奥地利', '澳大利亚', '新西兰', '加拿大', '墨西哥', '巴西', '阿根廷', '俄罗斯', '印度', '泰国', '越南', '新加坡', '马来西亚', '印度尼西亚', '菲律宾', '埃及', '南非', '土耳其', '希腊', '捷克', '波兰', '挪威', '瑞典', '丹麦', '芬兰', '冰岛', '其他'],
        travelCountryIndex: 0
    },
    // 页面加载时获取数据
    onLoad: function () {
        this.fetchProducts();
        this.fetchToBuyProducts();
        this.fetchTravelList();
    },
    // 页面显示时刷新数据
    onShow: function () {
        this.fetchProducts();
        this.fetchToBuyProducts();
        this.fetchTravelList();
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
                    // 对每个物品格式化日期并计算状态样式
                    const products = res.data.map(item => {
                        const bestBy = item.bestBy ? new Date(item.bestBy) : null;
                        const today = new Date();
                        let dateClass = 'date-normal';
                        if (bestBy) {
                            // 清除时间部分，按天比较
                            const b = new Date(bestBy.getFullYear(), bestBy.getMonth(), bestBy.getDate());
                            const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            const diffMs = b - t;
                            const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) {
                                dateClass = 'date-expired';
                            } else if (diffDays <= 30) {
                                dateClass = 'date-soon';
                            }
                        }
                        return {
                            ...item,
                            bestByFormatted: this.formatDate(item.bestBy),
                            dateClass
                        };
                    });
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
    // 获取待购物品列表
    fetchToBuyProducts: function() {
        wx.request({
            url: 'https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/ToBuy',
            method: 'GET',
            success: (res) => {
                if (res.statusCode === 200) {
                    const list = (res.data || []).map(item => ({
                        ...item,
                        // 兼容后端字段名：Priority / Name
                        priority: item.priority ?? item.Priority ?? 0,
                        name: item.name ?? item.Name ?? ''
                    }));
                    // 按优先级排序
                    list.sort((a, b) => a.priority - b.priority);
                    this.setData({ toBuyProducts: list });
                }
            }
        });
    },
    goToTarget: function () {
        wx.navigateTo({
            url: '/pages/add/add'
        });
    },
    goToAddToBuy: function() {
        wx.navigateTo({ url: '/pages/tobuy/add' });
    },
    // 删除待购物品
    onDeleteToBuy: function(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认删除',
            content: '确定要删除该待购物品吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.request({
                        url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/ToBuy/${id}`,
                        method: 'DELETE',
                        success: () => {
                            wx.showToast({ title: '删除成功', icon: 'success' });
                            this.fetchToBuyProducts();
                        },
                        fail: () => {
                            wx.showToast({ title: '删除失败', icon: 'error' });
                        }
                    });
                }
            }
        });
    },
    // 更新待购物品
    onUpdateToBuy: function(e) {
        const id = e.currentTarget.dataset.id;
        wx.navigateTo({ url: `/pages/tobuy/update?id=${id}` });
    },
    // 左滑交互 for main list
    onTouchStart: function (e) {
        this.setData({
            touchStartX: e.touches[0].clientX,
            touchStartY: e.touches[0].clientY, // 记录Y坐标
            isVerticalScroll: false, // 重置垂直滚动标记
            swipeIndex: -1
        });
    },
    onTouchMove: function (e) {
        const moveX = e.touches[0].clientX;
        const moveY = e.touches[0].clientY;
        const index = e.currentTarget.dataset.index;
        
        // 计算X和Y方向的移动距离
        const deltaX = Math.abs(moveX - this.data.touchStartX);
        const deltaY = Math.abs(moveY - this.data.touchStartY);
        
        // 如果Y方向的移动距离大于X方向，认为是垂直滚动
        if (deltaY > deltaX && deltaY > 10) {
            this.setData({ isVerticalScroll: true });
            return; // 不处理左右滑动
        }
        
        // 如果已经判定为垂直滚动，不处理左右滑动
        if (this.data.isVerticalScroll) {
            return;
        }
        
        // 处理左右滑动
        if (this.data.touchStartX - moveX > 50) {
            this.setData({ swipeIndex: index });
        }
        if (moveX - this.data.touchStartX > 50) {
            this.setData({ swipeIndex: -1 });
        }
    },
    onTouchEnd: function (e) {
        // 保持当前swipeIndex
        // 重置垂直滚动标记
        this.setData({ isVerticalScroll: false });
    },
    // 左滑交互 for toBuy list
    onTouchStartToBuy: function(e) {
        this.setData({
            toBuyTouchStartX: e.touches[0].clientX,
            toBuyTouchStartY: e.touches[0].clientY,
            isVerticalScroll: false,
            toBuySwipeIndex: -1
        });
    },
    onTouchMoveToBuy: function(e) {
        const moveX = e.touches[0].clientX;
        const moveY = e.touches[0].clientY;
        const index = e.currentTarget.dataset.index;
        const deltaX = Math.abs(moveX - this.data.toBuyTouchStartX);
        const deltaY = Math.abs(moveY - this.data.toBuyTouchStartY);
        if (deltaY > deltaX && deltaY > 10) {
            this.setData({ isVerticalScroll: true });
            return;
        }
        if (this.data.isVerticalScroll) return;
        if (this.data.toBuyTouchStartX - moveX > 50) {
            this.setData({ toBuySwipeIndex: index });
        }
        if (moveX - this.data.toBuyTouchStartX > 50) {
            this.setData({ toBuySwipeIndex: -1 });
        }
    },
    onTouchEndToBuy: function(e) {
        this.setData({ isVerticalScroll: false });
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

    // ========== 出行模块相关方法 ==========
    // 获取出行列表
    fetchTravelList: function() {
        const status = this.data.travelTab === 'pending' ? 'Pending' : 'Visited';
        wx.request({
            url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/Travel/status/${status}`,
            method: 'GET',
            success: (res) => {
                if (res.statusCode === 200) {
                    const list = (res.data || []).map(item => {
                        // 生成显示名称
                        let displayName = item.name || '';
                        if (item.type === 'Domestic' && item.domesticLocation) {
                            const loc = item.domesticLocation;
                            displayName = [loc.province, loc.city, loc.district].filter(Boolean).join('-');
                            if (item.name) displayName += `(${item.name})`;
                        } else if (item.type === 'International' && item.country) {
                            displayName = item.country;
                            if (item.name) displayName += `(${item.name})`;
                        }
                        return {
                            ...item,
                            displayName
                        };
                    });
                    list.sort((a, b) => a.priority - b.priority);
                    this.setData({ travelList: list });
                }
            }
        });
    },

    // 切换Tab
    switchTravelTab: function(e) {
        const tab = e.currentTarget.dataset.tab;
        if (tab !== this.data.travelTab) {
            this.setData({ travelTab: tab, travelSwipeIndex: -1 }, () => {
                this.fetchTravelList();
            });
        }
    },

    // 显示新增表单
    showAddTravelForm: function() {
        this.setData({
            showTravelForm: true,
            travelFormTypeIndex: 0,
            travelFormName: '',
            travelFormPriority: 1,
            travelProvinceIndex: 0,
            travelCityIndex: 0,
            travelDistrictIndex: 0,
            cityList: [],
            districtList: [],
            travelCountryIndex: 0
        });
    },

    // 取消新增表单
    cancelTravelForm: function() {
        this.setData({ showTravelForm: false });
    },

    // 目的地类型切换
    onTravelTypeChange: function(e) {
        this.setData({
            travelFormTypeIndex: parseInt(e.detail.value),
            travelProvinceIndex: 0,
            travelCityIndex: 0,
            travelDistrictIndex: 0,
            cityList: [],
            districtList: [],
            travelCountryIndex: 0
        });
    },

    // 省份选择
    onProvinceChange: function(e) {
        const index = parseInt(e.detail.value);
        // 这里简化处理，实际应根据省份加载对应城市
        const citiesByProvince = {
            '北京': ['北京市'],
            '上海': ['上海市'],
            '广东': ['广州', '深圳', '东莞', '佛山', '珠海', '中山', '惠州', '汕头', '湛江', '江门'],
            '浙江': ['杭州', '宁波', '温州', '绍兴', '嘉兴', '金华', '台州', '湖州'],
            '江苏': ['南京', '苏州', '无锡', '常州', '南通', '扬州', '镇江', '徐州'],
            '四川': ['成都', '绵阳', '德阳', '宜宾', '泸州', '达州', '南充', '乐山'],
            '湖北': ['武汉', '宜昌', '襄阳', '荆州', '黄冈', '十堰', '孝感'],
            '湖南': ['长沙', '株洲', '湘潭', '衡阳', '岳阳', '常德', '郴州'],
            '山东': ['济南', '青岛', '烟台', '威海', '潍坊', '淄博', '临沂', '济宁'],
            '河南': ['郑州', '洛阳', '开封', '新乡', '安阳', '焦作', '许昌', '南阳'],
            '福建': ['福州', '厦门', '泉州', '漳州', '莆田', '宁德', '龙岩'],
            '陕西': ['西安', '咸阳', '宝鸡', '渭南', '延安', '汉中', '榆林'],
            '云南': ['昆明', '大理', '丽江', '西双版纳', '曲靖', '玉溪', '红河'],
            '海南': ['海口', '三亚', '儋州', '琼海', '万宁'],
            '辽宁': ['沈阳', '大连', '鞍山', '抚顺', '锦州', '营口', '丹东'],
            '吉林': ['长春', '吉林', '四平', '延边', '通化', '白城'],
            '黑龙江': ['哈尔滨', '齐齐哈尔', '牡丹江', '佳木斯', '大庆', '绥化'],
            '河北': ['石家庄', '唐山', '保定', '邯郸', '秦皇岛', '张家口', '廊坊'],
            '山西': ['太原', '大同', '临汾', '运城', '晋城', '长治', '阳泉'],
            '安徽': ['合肥', '芜湖', '蚌埠', '淮南', '马鞍山', '安庆', '黄山'],
            '江西': ['南昌', '九江', '景德镇', '赣州', '吉安', '上饶', '宜春'],
            '贵州': ['贵阳', '遵义', '六盘水', '安顺', '毕节', '铜仁'],
            '甘肃': ['兰州', '天水', '白银', '酒泉', '嘉峪关', '张掖'],
            '青海': ['西宁', '海东', '海北', '海南', '黄南', '果洛'],
            '内蒙古': ['呼和浩特', '包头', '鄂尔多斯', '赤峰', '通辽', '呼伦贝尔'],
            '广西': ['南宁', '桂林', '柳州', '北海', '玉林', '百色', '梧州'],
            '西藏': ['拉萨', '日喀则', '昌都', '林芝', '山南', '那曲'],
            '宁夏': ['银川', '石嘴山', '吴忠', '固原', '中卫'],
            '新疆': ['乌鲁木齐', '喀什', '阿克苏', '伊犁', '克拉玛依', '吐鲁番'],
            '天津': ['天津市'],
            '重庆': ['重庆市'],
            '香港': ['香港'],
            '澳门': ['澳门'],
            '台湾': ['台北', '高雄', '台中', '台南', '新北', '桃园']
        };
        const province = this.data.provinceList[index];
        const cities = citiesByProvince[province] || ['其他'];
        this.setData({
            travelProvinceIndex: index,
            cityList: cities,
            travelCityIndex: 0,
            districtList: [],
            travelDistrictIndex: 0
        });
    },

    // 城市选择
    onCityChange: function(e) {
        const index = parseInt(e.detail.value);
        // 简化处理，实际应根据城市加载区县
        this.setData({
            travelCityIndex: index,
            districtList: ['市区', '郊区', '其他'],
            travelDistrictIndex: 0
        });
    },

    // 区县选择
    onDistrictChange: function(e) {
        this.setData({ travelDistrictIndex: parseInt(e.detail.value) });
    },

    // 国家选择
    onCountryChange: function(e) {
        this.setData({ travelCountryIndex: parseInt(e.detail.value) });
    },

    // 目的地名称输入
    onTravelNameInput: function(e) {
        this.setData({ travelFormName: e.detail.value });
    },

    // 优先级选择
    onTravelPriorityChange: function(e) {
        this.setData({ travelFormPriority: parseInt(e.detail.value) + 1 });
    },

    // 提交新增出行目的地
    submitTravelForm: function() {
        const { travelFormTypeIndex, travelFormName, travelFormPriority, provinceList, cityList, districtList, travelProvinceIndex, travelCityIndex, travelDistrictIndex, countryList, travelCountryIndex } = this.data;
        
        let destination = {
            name: travelFormName,
            type: travelFormTypeIndex === 0 ? 'Domestic' : 'International',
            priority: travelFormPriority,
            status: 'Pending'
        };

        if (travelFormTypeIndex === 0) {
            // 国内
            destination.domesticLocation = {
                province: provinceList[travelProvinceIndex] || '',
                city: cityList[travelCityIndex] || '',
                district: districtList[travelDistrictIndex] || ''
            };
        } else {
            // 国外
            destination.country = countryList[travelCountryIndex] || '';
        }

        wx.request({
            url: 'https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/Travel',
            method: 'POST',
            header: { 'Content-Type': 'application/json' },
            data: destination,
            success: (res) => {
                if (res.statusCode === 201 || res.statusCode === 200) {
                    wx.showToast({ title: '添加成功', icon: 'success' });
                    this.setData({ showTravelForm: false });
                    this.fetchTravelList();
                } else {
                    wx.showToast({ title: '添加失败', icon: 'error' });
                }
            },
            fail: () => {
                wx.showToast({ title: '网络错误', icon: 'error' });
            }
        });
    },

    // 删除出行目的地
    onDeleteTravel: function(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认删除',
            content: '确定要删除该目的地吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.request({
                        url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/Travel/${id}`,
                        method: 'DELETE',
                        success: () => {
                            wx.showToast({ title: '删除成功', icon: 'success' });
                            this.fetchTravelList();
                        },
                        fail: () => {
                            wx.showToast({ title: '删除失败', icon: 'error' });
                        }
                    });
                }
            }
        });
    },

    // 标记为已出行
    onMarkVisited: function(e) {
        const id = e.currentTarget.dataset.id;
        wx.showModal({
            title: '确认标记',
            content: '确定要标记该目的地为已出行吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.request({
                        url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/Travel/${id}/visited`,
                        method: 'POST',
                        success: (res) => {
                            if (res.statusCode === 200) {
                                wx.showToast({ title: '标记成功', icon: 'success' });
                                this.fetchTravelList();
                            } else {
                                wx.showToast({ title: '标记失败', icon: 'error' });
                            }
                        },
                        fail: () => {
                            wx.showToast({ title: '网络错误', icon: 'error' });
                        }
                    });
                }
            }
        });
    },

    // 出行列表左滑交互
    onTouchStartTravel: function(e) {
        this.setData({
            travelTouchStartX: e.touches[0].clientX,
            travelTouchStartY: e.touches[0].clientY,
            isVerticalScroll: false,
            travelSwipeIndex: -1
        });
    },
    onTouchMoveTravel: function(e) {
        const moveX = e.touches[0].clientX;
        const moveY = e.touches[0].clientY;
        const index = e.currentTarget.dataset.index;
        const deltaX = Math.abs(moveX - this.data.travelTouchStartX);
        const deltaY = Math.abs(moveY - this.data.travelTouchStartY);
        if (deltaY > deltaX && deltaY > 10) {
            this.setData({ isVerticalScroll: true });
            return;
        }
        if (this.data.isVerticalScroll) return;
        if (this.data.travelTouchStartX - moveX > 50) {
            this.setData({ travelSwipeIndex: index });
        }
        if (moveX - this.data.travelTouchStartX > 50) {
            this.setData({ travelSwipeIndex: -1 });
        }
    },
    onTouchEndTravel: function(e) {
        this.setData({ isVerticalScroll: false });
    }
});