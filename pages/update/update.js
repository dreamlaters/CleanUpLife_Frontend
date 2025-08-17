// 更新物品页面逻辑
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
        today: '',
        locationRooms: ['厨房', '客厅', '厕所', '卧室', '杂物间'],
        locationSiteIndex: null,
        locationSites: ['冰箱冷藏室', '冰箱冷冻室', '柜子', '桌面', '其他'],
        locationRoomIndex: null,
        id: null,
        // 新增种类相关字段
        categories: ['食物', '猫粮', '药品'],
        categoryIndex: null,
        storages: ['冷藏', '冷冻', '常温'],
        storageIndex: null,
        weightUnits: ['kg', 'pound'],
        weightUnitIndex: null
    },
    onLoad: function (options) {
        // 设置当前日期为默认最小可选日期
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        this.setData({ today: dateString });
        if (options.id) {
            this.setData({ id: options.id });
            // 处理category参数
            let category = options.category;
            if (!category) {
                category = 'Product';
            }
            this.setData({ category: category });
            this.fetchProduct(options.id, category);
        }
    },
    fetchProduct: function (id, category) {
        // 添加英文到中文的映射
        const categoryMapping = {
            'Food': '食物',
            'CatFood': '猫粮',
            'Medicine': '药品',
            'Product': '其他'
        };
        wx.showLoading({ title: '加载中...' });
        wx.request({
            url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/${category === 'Product' ? 'Products' : category}/${id}`,
            method: 'GET',
            success: (res) => {
                if (res.statusCode === 200) {
                    const item = res.data;
                    const locationRoomIndex = this.data.locationRooms.indexOf(item.location.roomPlacement);
                    const locationSiteIndex = this.data.locationSites.indexOf(item.location.site);
                    // 回填种类和特有字段索引
                    const categoryIndex = this.data.categories.indexOf(categoryMapping[item.category]);
                    let storageIndex = null, weightUnitIndex = null;
                    if (item.category === 'Food') {
                        storageIndex = this.data.storages.indexOf(item.storeOption);
                    }
                    if (item.category === 'CatFood') {
                        weightUnitIndex = this.data.weightUnits.indexOf(item.weightUnit);
                    }
                    this.setData({
                        formData: {
                            id: id,
                            name: item.name,
                            description: item.description,
                            bestBy: item.bestBy ? item.bestBy.split('T')[0] : '',
                            location: {
                                site: item.location.site,
                                roomPlacement: item.location.roomPlacement
                            },
                            storeOption: item.storeOption || '',
                            proteinPercentage: item.proteinPercentage || '',
                            weight: item.weight || '',
                            weightUnit: item.weightUnit || '',
                            flavor: item.flavor || '',
                            effect: item.effect || ''
                        },
                        locationRoomIndex: locationRoomIndex === -1 ? null : locationRoomIndex,
                        locationSiteIndex: locationSiteIndex === -1 ? null : locationSiteIndex,
                        categoryIndex: categoryIndex === -1 ? null : categoryIndex,
                        storageIndex: storageIndex === -1 ? null : storageIndex,
                        weightUnitIndex: weightUnitIndex === -1 ? null : weightUnitIndex
                    });
                } else {
                    wx.showToast({ title: '加载失败', icon: 'error' });
                }
            },
            fail: () => {
                wx.showToast({ title: '网络错误', icon: 'error' });
            },
            complete: () => {
                wx.hideLoading();
            }
        });
    },
    onNameInput: function (e) {
        this.setData({ 'formData.name': e.detail.value });
    },
    onDescriptionInput: function (e) {
        this.setData({ 'formData.description': e.detail.value });
    },
    onDateChange: function (e) {
        this.setData({ 'formData.bestBy': e.detail.value });
    },
    onLocationSiteChange: function (e) {
        const index = e.detail.value;
        this.setData({
            locationSiteIndex: index,
            'formData.location.site': this.data.locationSites[index]
        });
    },
    onLocationRoomChange: function (e) {
        const index = e.detail.value;
        this.setData({
            locationRoomIndex: index,
            'formData.location.roomPlacement': this.data.locationRooms[index]
        });
    },
    onCategoryChange: function (e) {
        const index = e.detail.value;
        this.setData({ categoryIndex: index });
    },
    onStorageChange: function (e) {
        const index = e.detail.value;
        this.setData({
            storageIndex: index,
            'formData.storeOption': this.data.storages[index]
        });
    },
    onProteinInput: function (e) {
        this.setData({ 'formData.proteinPercentage': e.detail.value });
    },
    onWeightInput: function (e) {
        this.setData({ 'formData.weight': e.detail.value });
    },
    onWeightUnitChange: function (e) {
        const index = e.detail.value;
        this.setData({
            weightUnitIndex: index,
            'formData.weightUnit': this.data.weightUnits[index]
        });
    },
    onFlavorInput: function (e) {
        this.setData({ 'formData.flavor': e.detail.value });
    },
    onEffectInput: function (e) {
        this.setData({ 'formData.effect': e.detail.value });
    },
    updateForm: function () {
        if (!this.data.formData.name) {
            wx.showToast({ title: '物品名称不能为空', icon: 'error' });
            return;
        }
        if (!this.data.formData.bestBy) {
            wx.showToast({ title: '请选择保质期到期日', icon: 'error' });
            return;
        }
        if (!this.data.formData.location.site) {
            wx.showToast({ title: '请选择存放位置', icon: 'error' });
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
        const productData = {
            id: this.data.id,
            name: this.data.formData.name,
            description: this.data.formData.description || '',
            bestBy: this.data.formData.bestBy + 'T00:00:00Z',
            location: {
                site: this.data.formData.location.site,
                roomPlacement: this.data.formData.location.roomPlacement || ''
            },
            category: category === '食物' ? "Food" : category === '猫粮' ? 'CatFood' : category === '药品' ? 'Medicine' : 'Product',
        };
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
        wx.showLoading({ title: '更新中...' });
        wx.request({
            url: `https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/${productData.category}/${this.data.id}`,
            method: 'PUT',
            data: productData,
            header: { 'content-type': 'application/json' },
            success: (res) => {
                if (res.statusCode === 200) {
                    wx.showToast({ title: '更新成功', icon: 'success' });
                    setTimeout(() => { wx.navigateBack(); }, 1500);
                } else {
                    wx.showToast({ title: '更新失败', icon: 'error' });
                }
            },
            fail: () => {
                wx.showToast({ title: '网络错误', icon: 'error' });
            },
            complete: () => {
                wx.hideLoading();
            }
        });
    }
});
