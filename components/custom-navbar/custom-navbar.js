Component({
  data: {
    menuReserve: 108
  },
  properties: {
    title: { type: String, value: '' },
    greeting: { type: String, value: '' },
    dateText: { type: String, value: '' },
    showReminder: { type: Boolean, value: false },
    showReminderDot: { type: Boolean, value: false },
    statusBarHeight: { type: Number, value: 20 },
    navbarHeight: { type: Number, value: 88 }
  },
  lifetimes: {
    attached() {
      try {
        const systemInfo = wx.getWindowInfo
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
        const menuButton = wx.getMenuButtonBoundingClientRect();
        const windowWidth = systemInfo.windowWidth || systemInfo.screenWidth;
        const menuReserve = Math.max(88, windowWidth - menuButton.left + 10);
        this.setData({ menuReserve });
      } catch (err) {
        console.warn('无法读取微信胶囊位置，使用默认导航安全区', err);
      }
    }
  }
})
