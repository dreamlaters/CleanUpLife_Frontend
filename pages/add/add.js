// 添加物品页面逻辑
Page({
    data: {
        formData: {
            name: '',
            description: '',
            bestBy: '',
            location: {
                site: '',
                roomPlacement: ''
            },
            // 新增特有字段
            storeOption: '', // 食物
            proteinPercentage: '', // 猫粮
            weight: '', // 猫粮
            weightUnit: '', // 猫粮
            flavor: '', // 猫粮
            effect: '' // 药品
        },
        today: '', // 当前日期，用于日期选择器最小值
        locationRooms: ['厨房', '客厅', '厕所', '卧室', '杂物间'], // 存放大类选项
        locationSiteIndex: null, // 当前选中的大类索引
        locationSites: ['冰箱冷藏室', '冰箱冷冻室', '柜子', '桌面', '其他'], // 具体位置选项
        locationRoomIndex: null, // 当前选中的具体位置索引
        // 新增种类相关字段
        categories: ['食物', '猫粮', '药品'],
        categoryIndex: null,
        storages: ['冷藏', '冷冻', '常温'],
        storageIndex: null,
        weightUnits: ['kg', 'pound'],
        weightUnitIndex: null
    },
    // 页面加载时设置当前日期
    onLoad: function () {
        // 设置当前日期为默认最小可选日期
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        this.setData({
            today: dateString
        });
    },
    // 物品名称输入处理
    onNameInput: function (e) {
        this.setData({
            'formData.name': e.detail.value
        });
    },
    // 物品描述输入处理
    onDescriptionInput: function (e) {
        this.setData({
            'formData.description': e.detail.value
        });
    },
    // 保质期到期日选择处理
    onDateChange: function (e) {
        this.setData({
            'formData.bestBy': e.detail.value
        });
    },
    // 存放大类选择处理
    onLocationSiteChange: function (e) {
        const index = e.detail.value;
        this.setData({
            locationSiteIndex: index,
            'formData.location.site': this.data.locationSites[index]
        });
    },
    // 具体位置选择处理
    onLocationRoomChange: function (e) {
        const index = e.detail.value;
        this.setData({
            locationRoomIndex: index,
            'formData.location.roomPlacement': this.data.locationRooms[index]
        });
    },
    // 种类选择处理
    onCategoryChange: function (e) {
        const index = e.detail.value;
        this.setData({
            categoryIndex: index
        });
    },
    // 存储条件选择处理
    onStorageChange: function (e) {
        const index = e.detail.value;
        this.setData({
            storageIndex: index,
            'formData.storeOption': this.data.storages[index]
        });
    },
    // 猫粮蛋白质比例输入处理
    onProteinInput: function (e) {
        this.setData({
            'formData.proteinPercentage': e.detail.value
        });
    },
    // 猫粮重量输入处理
    onWeightInput: function (e) {
        this.setData({
            'formData.weight': e.detail.value
        });
    },
    // 猫粮单位选择处理
    onWeightUnitChange: function (e) {
        const index = e.detail.value;
        this.setData({
            weightUnitIndex: index,
            'formData.weightUnit': this.data.weightUnits[index]
        });
    },
    // 猫粮口味输入处理
    onFlavorInput: function (e) {
        this.setData({
            'formData.flavor': e.detail.value
        });
    },
    // 药品功效输入处理
    onEffectInput: function (e) {
        this.setData({
            'formData.effect': e.detail.value
        });
    },
    // 表单提交处理
    submitForm: function () {
        // 表单验证
        if (!this.data.formData.name) {
            wx.showToast({
                title: '物品名称不能为空',
                icon: 'error'
            });
            return;
        }
        if (!this.data.formData.bestBy) {
            wx.showToast({
                title: '请选择保质期到期日',
                icon: 'error'
            });
            return;
        }
        if (!this.data.formData.location.site) {
            wx.showToast({
                title: '请选择存放位置',
                icon: 'error'
            });
            return;
        }
        // 新增种类校验
        if (this.data.categoryIndex === null) {
            wx.showToast({ title: '请选择物品种类', icon: 'error' });
            return;
        }
        const category = this.data.categories[this.data.categoryIndex];
        // 特有字段校验
        if (category === '食物' && this.data.storageIndex === null) {
            wx.showToast({ title: '请选择存储条件', icon: 'error' });
            return;
        }
        if (category === '猫粮' && (!this.data.formData.proteinPercentage || !this.data.formData.weight || this.data.weightUnitIndex === null || !this.data.formData.flavor)) {
            wx.showToast({ title: '请填写猫粮所有特有字段', icon: 'error' });
            return;
        }
        if (category === '药品' && !this.data.formData.effect) {
            wx.showToast({ title: '请填写药品功效', icon: 'error' });
            return;
        }
        // 构建提交的数据
        const productData = {
            name: this.data.formData.name,
            description: this.data.formData.description || '',
            bestBy: this.data.formData.bestBy + 'T00:00:00Z', // 添加时间部分，符合ISO格式
            location: {
                site: this.data.formData.location.site,
                roomPlacement: this.data.formData.location.roomPlacement || ''
            },
            category: category === '食物' ? "Food" : category === '猫粮' ? 'CatFood' : category === '药品' ? 'Medicine' : 'Product',
        };
        // 特有字段
        if (category === '食物') {
            productData.storeOption = this.data.formData.storeOption;
        } else if (category === '猫粮') {
            productData.proteinPercentage = this.data.formData.proteinPercentage;
            productData.weight = this.data.formData.weight;
            productData.weightUnit = this.data.formData.weightUnit;
            productData.flavor = this.data.formData.flavor;
        } else if (category === '药品') {
            productData.effect = this.data.formData.effect;
        }
        // 显示加载中
        wx.showLoading({
            title: '提交中...',
        });
        // 调用API提交数据
        wx.request({
            url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/${productData.category}`,
            method: 'POST',
            data: productData,
            header: {
                'content-type': 'application/json'
            },
            success: (res) => {
                if (res.statusCode === 201) {
                    // 提交成功
                    wx.showToast({
                        title: '添加成功',
                        icon: 'success'
                    });
                    // 延迟返回首页，让用户看到成功提示
                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);
                } else {
                    // API返回错误
                    wx.showToast({
                        title: '添加失败: ' + res.data.message || '未知错误',
                        icon: 'error'
                    });
                }
            },
            fail: () => {
                // 网络请求失败
                wx.showToast({
                    title: '网络错误，请重试',
                    icon: 'error'
                });
            },
            complete: () => {
                wx.hideLoading();
            }
        });
    }
});