Page({
    data: {
        openid: ''
    },
    onLoad: function () {
        this.getOpenid();
    },
    getOpenid: function () {
        wx.login({
            success: (res) => {
                if (res.code) {
                    // 这里需要你自己的后端服务换取 openid，演示用mock
                    wx.request({
                        url: 'https://cleanuplife-eudgakdhcwcpfjb0.japanwest-01.azurewebsites.net/OpenId/wechat',
                        method: 'POST',
                        data: {
                            Code: res.code
                        },
                        success: (resp) => {
                            if (resp.openid || resp.data.openid) {
                                this.setData({ openid: resp.data.openid });
                            } else {
                                this.setData({openid:JSON.parse(resp.data.toString().substr(18)).openid});
                            }
                        },
                        fail: () => {
                            this.setData({ openid: '请求失败' });
                        }
                    });
                } else {
                    this.setData({ openid: 'wx.login失败' });
                }
            },
            fail: () => {
                this.setData({ openid: 'wx.login失败' });
            }
        });
    },
    onRequestSubscribe: function() {
      // 这里填写你自己的模板ID数组
      wx.requestSubscribeMessage({
        tmplIds: ['UxALkgoVSieSCdFhfkeX50yu_ORs6zMdpgmMkVMWiJY'], // 替换为你的消息模板ID
        success: (res) => {
            wx.showToast({ title: '授权结果: ' + JSON.stringify(res), icon: 'none' });
        },
        fail: (err) => {
            wx.showToast({ title: '授权失败', icon: 'none' });
        }
      });
    }
});