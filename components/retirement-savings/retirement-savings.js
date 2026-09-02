const api = require('../../utils/api')

const CATEGORIES = [
  { value: 'BankCard', label: '银行卡', icon: 'bank-card' },
  { value: 'Stock', label: '股票', icon: 'stock' },
  { value: 'HousingFund', label: '公积金', icon: 'housing-fund' }
]

const OWNERS = {
  Pig: { label: '猪猪', emoji: '🐷' },
  Donkey: { label: '毛驴', emoji: '🫏' }
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function inputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? String(parsed) : ''
}

Component({
  data: {
    loading: true,
    error: '',
    dashboard: null,
    dashboardView: {},
    currentOwner: '',
    canEditShared: false,
    accounts: [],
    accountGroups: [],
    showMonthly: false,
    monthlyLoading: false,
    monthlyError: '',
    monthlySubmitting: false,
    monthlyEntry: null,
    monthlyAccounts: [],
    monthlyGroups: [],
    monthlyMortgageInput: '',
    monthlyMortgageOriginal: '',
    accountModalOpen: false,
    accountSaving: false,
    accountForm: {
      id: '',
      name: '',
      category: 'BankCard',
      categoryIndex: 0,
      currentAmount: ''
    },
    categoryLabels: CATEGORIES.map(item => item.label),
    goalModalOpen: false,
    goalSaving: false,
    goalInput: '',
    mortgageModalOpen: false,
    mortgageSaving: false,
    mortgageForm: {
      name: '',
      originalPrincipal: '',
      currentRemainingPrincipal: ''
    },
    trendOwner: 'all',
    trendCategory: 'all',
    trendRange: '6m',
    trendLoading: true,
    trendError: '',
    trendPoints: [],
    trendDescription: '家庭净资产 · 最近 6 个月',
    trendOwnerOptions: [
      { value: 'all', label: '家庭' },
      { value: 'Pig', label: '猪' },
      { value: 'Donkey', label: '驴' }
    ],
    trendCategoryOptions: [
      { value: 'all', label: '全部' },
      { value: 'BankCard', label: '银行卡' },
      { value: 'Stock', label: '股票基金' },
      { value: 'HousingFund', label: '公积金' }
    ],
    trendRangeOptions: [
      { value: '6m', label: '近 6 月' },
      { value: '1y', label: '近 1 年' },
      { value: 'all', label: '全部' }
    ]
  },

  lifetimes: {
    attached() {
      this.refresh()
    },
    detached() {
      this._destroyed = true
      this.canvas = null
      this.ctx = null
    }
  },

  methods: {
    refresh() {
      this._destroyed = false
      this.setData({ loading: true, error: '' })

      const dashboardRequest = api.get('/RetirementSavings/dashboard', { showLoading: false })
      const accountsRequest = api.get('/RetirementSavings/accounts', { showLoading: false })
      const trendRequest = this.loadTrends()

      return Promise.all([dashboardRequest, accountsRequest])
        .then(([dashboardResponse, accountsResponse]) => {
          if (this._destroyed) return
          const dashboard = dashboardResponse && dashboardResponse.dashboard
            ? dashboardResponse.dashboard
            : (dashboardResponse || {})
          const accountPayload = accountsResponse && accountsResponse.accounts
            ? accountsResponse.accounts
            : accountsResponse
          const accounts = Array.isArray(accountPayload)
            ? accountPayload
            : (Array.isArray(dashboard.accounts) ? dashboard.accounts : [])
          const currentOwner = this._getCurrentOwner()

          this.setData({
            loading: false,
            dashboard,
            currentOwner,
            canEditShared: currentOwner === 'Pig' || currentOwner === 'Donkey',
            dashboardView: this._decorateDashboard(dashboard),
            accounts,
            accountGroups: this._groupAccounts(accounts, currentOwner)
          }, () => {
            this.triggerEvent('dashboardchange', { dashboard })
            this._initCanvas()
          })
        })
        .catch(() => {
          if (!this._destroyed) {
            this.setData({
              loading: false,
              error: '存钱簿暂时没有打开，请检查网络后重试。'
            })
          }
        })
        .then(() => trendRequest)
    },

    retryLoad() {
      this.refresh()
    },

    _getCurrentOwner() {
      const app = getApp()
      return app && app.globalData ? (app.globalData.player || '') : ''
    },

    _decorateDashboard(dashboard) {
      const data = dashboard || {}
      const goal = data.goal || {}
      const mortgage = data.mortgage || {}
      const status = data.currentMonthStatus || {}
      const target = numberValue(goal.targetAmount !== undefined ? goal.targetAmount : data.targetAmount)
      const netAssets = numberValue(data.netAssets)
      const progress = numberValue(data.progressPercent)
      const remaining = numberValue(data.remainingToGoal, target - netAssets)
      const hasMonthChange = data.monthChange !== null && data.monthChange !== undefined
      const monthChange = numberValue(data.monthChange)
      const mortgageRemaining = numberValue(
        mortgage.currentRemainingPrincipal !== undefined
          ? mortgage.currentRemainingPrincipal
          : data.mortgageRemainingPrincipal
      )
      const missingOwners = Array.isArray(status.missingOwners) ? status.missingOwners : []
      const hasGoal = target > 0
      const originalPrincipal = numberValue(mortgage.originalPrincipal)
      const hasMortgage = Boolean(mortgage.name) || originalPrincipal > 0
      const mortgagePaidPercent = originalPrincipal > 0
        ? Math.max(0, Math.min(100, (originalPrincipal - mortgageRemaining) / originalPrincipal * 100))
        : 0

      return {
        netAssetsText: this._formatRmb(netAssets),
        netAssetsNegative: netAssets < 0,
        grossAssetsText: this._formatRmb(numberValue(data.grossAssets)),
        hasGoal,
        targetText: hasGoal ? this._formatRmb(target) : '尚未设置',
        progressText: hasGoal ? `${this._trimNumber(progress)}%` : '待设定',
        progressWidth: Math.max(0, Math.min(100, progress)),
        remainingText: !hasGoal
          ? '先一起定下退休目标'
          : remaining > 0
          ? `还差 ${this._formatRmb(remaining)}`
          : (remaining < 0 ? `已超过目标 ${this._formatRmb(Math.abs(remaining))}` : '恰好达到共同目标'),
        goalReached: hasGoal && remaining <= 0,
        monthChangeText: hasMonthChange
          ? `${monthChange > 0 ? '+' : ''}${this._formatRmb(monthChange)}`
          : '数据不足',
        monthChangeTone: hasMonthChange && monthChange > 0
          ? 'positive'
          : (hasMonthChange && monthChange < 0 ? 'negative' : 'neutral'),
        hasMortgage,
        mortgageText: hasMortgage ? this._formatRmb(mortgageRemaining) : '未设置',
        mortgagePaidText: hasMortgage ? `已还 ${this._trimNumber(mortgagePaidPercent)}%` : '添加房贷',
        pigAssetsText: this._formatRmb(numberValue(data.pigAssets)),
        donkeyAssetsText: this._formatRmb(numberValue(data.donkeyAssets)),
        month: status.month || this._currentMonth(),
        pigConfirmed: !!status.pigConfirmed,
        donkeyConfirmed: !!status.donkeyConfirmed,
        mortgageConfirmed: status.mortgageConfirmed !== false,
        isProvisional: !!status.isProvisional,
        missingText: missingOwners.map(owner => OWNERS[owner] ? OWNERS[owner].label : owner).join('、'),
        ownerConfirmed: this._ownerConfirmed(status, this._getCurrentOwner()),
        latestSnapshotText: this._formatDateTime(data.latestSnapshotAt)
      }
    },

    _ownerConfirmed(status, owner) {
      if (owner === 'Pig') return !!status.pigConfirmed
      if (owner === 'Donkey') return !!status.donkeyConfirmed
      return false
    },

    _groupAccounts(accounts, currentOwner) {
      return ['Pig', 'Donkey'].map(owner => {
        const ownerAccounts = accounts.filter(account => account.owner === owner)
        const categories = CATEGORIES.map(category => ({
          value: category.value,
          label: category.label,
          icon: category.icon,
          accounts: ownerAccounts
            .filter(account => account.category === category.value)
            .map(account => ({
              ...account,
              amountText: this._formatRmb(numberValue(account.currentAmount)),
              isMine: owner === currentOwner
            }))
        })).filter(category => category.accounts.length)

        return {
          owner,
          ownerLabel: OWNERS[owner].label,
          emoji: OWNERS[owner].emoji,
          totalText: this._formatRmb(ownerAccounts.reduce(
            (sum, account) => sum + numberValue(account.currentAmount),
            0
          )),
          categories
        }
      })
    },

    toggleMonthly() {
      if (this.data.showMonthly) {
        this.setData({ showMonthly: false })
        return
      }
      this.setData({ showMonthly: true })
      this.loadMonthlyEntry()
    },

    loadMonthlyEntry() {
      const month = (this.data.dashboardView && this.data.dashboardView.month) || this._currentMonth()
      this.setData({ monthlyLoading: true, monthlyError: '' })

      return api.get(`/RetirementSavings/monthly-entry?month=${encodeURIComponent(month)}`, {
        showLoading: false
      }).then(response => {
        const source = response || {}
        const rawEntry = source.month ? source : (source.monthlyEntry || {})
        const entry = {
          ...rawEntry,
          month: rawEntry.month || month,
          owner: rawEntry.owner || this.data.currentOwner
        }
        const accounts = Array.isArray(entry.accounts) ? entry.accounts.map(account => ({
          ...account,
          amountInput: inputValue(account.currentAmount),
          previousText: this._formatRmb(numberValue(account.previousAmount)),
          currentText: this._formatRmb(numberValue(account.currentAmount))
        })) : []
        const mortgage = entry.mortgage || {}
        const mortgageAmount = typeof mortgage === 'number'
          ? mortgage
          : (mortgage.currentRemainingPrincipal !== undefined
            ? mortgage.currentRemainingPrincipal
            : mortgage.remainingPrincipal)

        this.setData({
          monthlyLoading: false,
          monthlyEntry: entry,
          monthlyAccounts: accounts,
          monthlyGroups: this._groupMonthlyAccounts(accounts),
          monthlyMortgageInput: inputValue(mortgageAmount),
          monthlyMortgageOriginal: inputValue(mortgageAmount)
        })
      }).catch(() => {
        this.setData({
          monthlyLoading: false,
          monthlyError: '本月记录加载失败，请稍后再试。'
        })
      })
    },

    _groupMonthlyAccounts(accounts) {
      return CATEGORIES.map(category => ({
        value: category.value,
        label: category.label,
        icon: category.icon,
        accounts: accounts.filter(account => account.category === category.value)
      })).filter(category => category.accounts.length)
    },

    onMonthlyAmountInput(e) {
      const id = String(e.currentTarget.dataset.id)
      const value = e.detail.value
      const accounts = this.data.monthlyAccounts.map(account => (
        String(account.id) === id ? { ...account, amountInput: value } : account
      ))
      this.setData({
        monthlyAccounts: accounts,
        monthlyGroups: this._groupMonthlyAccounts(accounts)
      })
    },

    onMonthlyMortgageInput(e) {
      this.setData({ monthlyMortgageInput: e.detail.value })
    },

    submitMonthlyEntry() {
      if (this.data.monthlySubmitting || !this.data.monthlyEntry) return

      const invalidAccount = this.data.monthlyAccounts.some(account => (
        account.amountInput === '' ||
        !Number.isFinite(Number(account.amountInput)) ||
        Number(account.amountInput) < 0
      ))
      if (invalidAccount) {
        wx.showToast({ title: '请填写每个账户的金额', icon: 'none' })
        return
      }

      const payload = {
        accounts: this.data.monthlyAccounts.map(account => ({
          accountId: account.id,
          amount: Number(account.amountInput)
        }))
      }
      const mortgageInput = this.data.monthlyMortgageInput
      const mortgageChanged = numberValue(mortgageInput, NaN)
        !== numberValue(this.data.monthlyMortgageOriginal, NaN)
      if (mortgageInput !== '' && mortgageChanged) {
        if (!Number.isFinite(Number(mortgageInput)) || Number(mortgageInput) < 0) {
          wx.showToast({ title: '请填写正确的房贷余额', icon: 'none' })
          return
        }
        payload.mortgageRemainingPrincipal = Number(mortgageInput)
      }

      this.setData({ monthlySubmitting: true })
      api.put(
        `/RetirementSavings/monthly-entry/${encodeURIComponent(this.data.monthlyEntry.month)}`,
        payload,
        { showLoading: false }
      ).then(() => {
        wx.showToast({ title: this.data.dashboardView.ownerConfirmed ? '本月记录已更新' : '本月记录已确认' })
        this.setData({ monthlySubmitting: false })
        return this.refresh()
      }).then(() => {
        if (this.data.showMonthly) return this.loadMonthlyEntry()
        return null
      }).catch(() => {
        this.setData({ monthlySubmitting: false })
      })
    },

    openAddAccount() {
      if (!this.data.canEditShared) return
      this.setData({
        accountModalOpen: true,
        accountForm: {
          id: '',
          name: '',
          category: 'BankCard',
          categoryIndex: 0,
          currentAmount: ''
        }
      })
    },

    openEditAccount(e) {
      const id = String(e.currentTarget.dataset.id)
      const account = this.data.accounts.find(item => String(item.id) === id)
      if (!account || account.owner !== this.data.currentOwner) return
      const categoryIndex = Math.max(0, CATEGORIES.findIndex(item => item.value === account.category))
      this.setData({
        accountModalOpen: true,
        accountForm: {
          id: account.id,
          name: account.name || '',
          category: CATEGORIES[categoryIndex].value,
          categoryIndex,
          currentAmount: inputValue(account.currentAmount)
        }
      })
    },

    closeAccountModal() {
      if (!this.data.accountSaving) this.setData({ accountModalOpen: false })
    },

    onAccountNameInput(e) {
      this.setData({ 'accountForm.name': e.detail.value })
    },

    onAccountAmountInput(e) {
      this.setData({ 'accountForm.currentAmount': e.detail.value })
    },

    onAccountCategoryChange(e) {
      const categoryIndex = Number(e.detail.value)
      this.setData({
        'accountForm.categoryIndex': categoryIndex,
        'accountForm.category': CATEGORIES[categoryIndex].value
      })
    },

    saveAccount() {
      const form = this.data.accountForm
      const name = form.name.trim()
      const amount = Number(form.currentAmount)
      if (!name) {
        wx.showToast({ title: '请填写账户名称', icon: 'none' })
        return
      }
      if (form.currentAmount === '' || !Number.isFinite(amount) || amount < 0) {
        wx.showToast({ title: '请填写正确的当前金额', icon: 'none' })
        return
      }

      const payload = { name, category: form.category, currentAmount: amount }
      const request = form.id
        ? api.put(`/RetirementSavings/accounts/${form.id}`, payload, { showLoading: false })
        : api.post('/RetirementSavings/accounts', payload, { showLoading: false })

      this.setData({ accountSaving: true })
      request.then(() => {
        wx.showToast({ title: form.id ? '账户已更新' : '账户已添加' })
        this.setData({ accountSaving: false, accountModalOpen: false })
        return this.refresh()
      }).catch(() => {
        this.setData({ accountSaving: false })
      })
    },

    deleteAccount(e) {
      const id = String(e.currentTarget.dataset.id)
      const account = this.data.accounts.find(item => String(item.id) === id)
      if (!account || account.owner !== this.data.currentOwner) return

      wx.showModal({
        title: '删除这个账户？',
        content: `“${account.name}”的历史快照会保留，但账户不再出现在今后的月度记录中。`,
        confirmText: '删除',
        confirmColor: '#b85c52',
        success: result => {
          if (!result.confirm) return
          api.del(`/RetirementSavings/accounts/${account.id}`, { showLoading: false })
            .then(() => {
              wx.showToast({ title: '账户已删除' })
              return this.refresh()
            })
            .catch(error => {
              console.error('删除储蓄账户失败', error)
            })
        }
      })
    },

    openGoalModal() {
      if (!this.data.canEditShared) return
      const dashboard = this.data.dashboard || {}
      const goal = dashboard.goal || {}
      this.setData({
        goalModalOpen: true,
        goalInput: inputValue(goal.targetAmount !== undefined ? goal.targetAmount : dashboard.targetAmount)
      })
    },

    closeGoalModal() {
      if (!this.data.goalSaving) this.setData({ goalModalOpen: false })
    },

    onGoalInput(e) {
      this.setData({ goalInput: e.detail.value })
    },

    saveGoal() {
      const targetAmount = Number(this.data.goalInput)
      if (this.data.goalInput === '' || !Number.isFinite(targetAmount) || targetAmount <= 0) {
        wx.showToast({ title: '目标金额需要大于 0', icon: 'none' })
        return
      }
      this.setData({ goalSaving: true })
      api.put('/RetirementSavings/goal', { targetAmount }, { showLoading: false })
        .then(() => {
          wx.showToast({ title: '共同目标已保存' })
          this.setData({ goalSaving: false, goalModalOpen: false })
          return this.refresh()
        })
        .catch(() => this.setData({ goalSaving: false }))
    },

    openMortgageModal() {
      if (!this.data.canEditShared) return
      const dashboard = this.data.dashboard || {}
      const mortgage = dashboard.mortgageDraft || dashboard.mortgage || {}
      this.setData({
        mortgageModalOpen: true,
        mortgageForm: {
          name: mortgage.name || '',
          originalPrincipal: inputValue(mortgage.originalPrincipal),
          currentRemainingPrincipal: inputValue(mortgage.currentRemainingPrincipal)
        }
      })
    },

    closeMortgageModal() {
      if (!this.data.mortgageSaving) this.setData({ mortgageModalOpen: false })
    },

    onMortgageNameInput(e) {
      this.setData({ 'mortgageForm.name': e.detail.value })
    },

    onMortgageOriginalInput(e) {
      this.setData({ 'mortgageForm.originalPrincipal': e.detail.value })
    },

    onMortgageRemainingInput(e) {
      this.setData({ 'mortgageForm.currentRemainingPrincipal': e.detail.value })
    },

    saveMortgage() {
      const form = this.data.mortgageForm
      const originalPrincipal = Number(form.originalPrincipal)
      const currentRemainingPrincipal = Number(form.currentRemainingPrincipal)
      if (!form.name.trim()) {
        wx.showToast({ title: '请填写房贷名称', icon: 'none' })
        return
      }
      if (
        form.originalPrincipal === '' ||
        form.currentRemainingPrincipal === '' ||
        !Number.isFinite(originalPrincipal) ||
        !Number.isFinite(currentRemainingPrincipal) ||
        originalPrincipal < 0 ||
        currentRemainingPrincipal < 0 ||
        currentRemainingPrincipal > originalPrincipal
      ) {
        wx.showToast({ title: '请填写正确的房贷金额', icon: 'none' })
        return
      }

      this.setData({ mortgageSaving: true })
      api.put('/RetirementSavings/mortgage', {
        name: form.name.trim(),
        originalPrincipal,
        currentRemainingPrincipal
      }, { showLoading: false }).then(() => {
        wx.showToast({ title: '房贷设置已保存' })
        this.setData({ mortgageSaving: false, mortgageModalOpen: false })
        return this.refresh()
      }).catch(() => this.setData({ mortgageSaving: false }))
    },

    stopPropagation() {},

    onTrendFilter(e) {
      const group = e.currentTarget.dataset.group
      const value = e.currentTarget.dataset.value
      const updates = {}
      updates[group] = value
      this.setData(updates, () => this.loadTrends())
    },

    loadTrends() {
      const { trendRange, trendOwner, trendCategory } = this.data
      this.setData({ trendLoading: true, trendError: '' })
      const url = `/RetirementSavings/trends?range=${encodeURIComponent(trendRange)}&owner=${encodeURIComponent(trendOwner)}&category=${encodeURIComponent(trendCategory)}`

      return api.get(url, { showLoading: false }).then(response => {
        if (this._destroyed) return
        const source = response || {}
        const payload = source.points ? source : (source.trends || {})
        const points = Array.isArray(payload.points) ? payload.points.map(point => ({
          ...point,
          amount: numberValue(point.amount),
          isProvisional: !!point.isProvisional
        })) : []
        this.setData({
          trendLoading: false,
          trendPoints: points,
          trendDescription: this._trendDescription()
        }, () => this._initCanvas())
      }).catch(() => {
        if (!this._destroyed) {
          this.setData({
            trendLoading: false,
            trendError: '趋势暂时加载失败，点此重试。'
          }, () => this._drawChart())
        }
      })
    },

    retryTrends() {
      this.loadTrends()
    },

    _trendDescription() {
      const owner = this.data.trendOwnerOptions.find(item => item.value === this.data.trendOwner)
      const category = this.data.trendCategoryOptions.find(item => item.value === this.data.trendCategory)
      const range = this.data.trendRangeOptions.find(item => item.value === this.data.trendRange)
      const metric = this.data.trendOwner === 'all' && this.data.trendCategory === 'all'
        ? '家庭净资产'
        : `${owner ? owner.label : ''} · ${category ? category.label : ''}`
      return `${metric} · ${range ? range.label : ''}`
    },

    _initCanvas() {
      if (this._destroyed) return
      const query = wx.createSelectorQuery().in(this)
      query.select('#retirement-trend-canvas')
        .fields({ node: true, size: true })
        .exec(result => {
          if (!result[0] || !result[0].node || !result[0].width) return
          const canvas = result[0].node
          const ctx = canvas.getContext('2d')
          const systemInfo = wx.getSystemInfoSync()
          const dpr = systemInfo.pixelRatio || 2
          canvas.width = result[0].width * dpr
          canvas.height = result[0].height * dpr
          ctx.scale(dpr, dpr)
          this.canvas = canvas
          this.ctx = ctx
          this.canvasWidth = result[0].width
          this.canvasHeight = result[0].height
          this._drawChart()
        })
    },

    _drawChart() {
      if (!this.ctx) return
      const ctx = this.ctx
      const width = this.canvasWidth
      const height = this.canvasHeight
      const points = this.data.trendPoints || []

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#fffdf8'
      ctx.fillRect(0, 0, width, height)

      if (!points.length) {
        ctx.fillStyle = '#8d7c70'
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(this.data.trendLoading ? '正在整理每月快照…' : '确认第一个月后，趋势会出现在这里', width / 2, height / 2)
        return
      }

      const padding = { left: 55, right: 14, top: 20, bottom: 38 }
      const chartWidth = width - padding.left - padding.right
      const chartHeight = height - padding.top - padding.bottom
      const values = points.map(point => point.amount)
      let min = Math.min.apply(null, values)
      let max = Math.max.apply(null, values)
      const spread = max - min || Math.max(Math.abs(max) * 0.2, 1000)
      min -= spread * 0.14
      max += spread * 0.14

      ctx.font = '10px sans-serif'
      ctx.fillStyle = '#8d7c70'
      ctx.lineWidth = 1
      ctx.setLineDash([])
      for (let step = 0; step <= 4; step += 1) {
        const y = padding.top + (chartHeight / 4) * step
        const value = max - ((max - min) / 4) * step
        ctx.strokeStyle = '#eadfd2'
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.stroke()
        ctx.textAlign = 'right'
        ctx.fillText(this._formatAxis(value), padding.left - 8, y + 3)
      }

      if (min < 0 && max > 0) {
        const zeroY = padding.top + chartHeight - ((0 - min) / (max - min)) * chartHeight
        ctx.strokeStyle = '#c8b7a7'
        ctx.beginPath()
        ctx.moveTo(padding.left, zeroY)
        ctx.lineTo(width - padding.right, zeroY)
        ctx.stroke()
      }

      const xStep = chartWidth / Math.max(points.length - 1, 1)
      const plotted = points.map((point, index) => ({
        ...point,
        x: padding.left + (points.length === 1 ? chartWidth / 2 : xStep * index),
        y: padding.top + chartHeight - ((point.amount - min) / (max - min)) * chartHeight
      }))

      for (let index = 1; index < plotted.length; index += 1) {
        const previous = plotted[index - 1]
        const current = plotted[index]
        ctx.beginPath()
        ctx.strokeStyle = '#b8664f'
        ctx.lineWidth = 2.5
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.setLineDash(previous.isProvisional || current.isProvisional ? [6, 5] : [])
        ctx.moveTo(previous.x, previous.y)
        ctx.lineTo(current.x, current.y)
        ctx.stroke()
      }
      ctx.setLineDash([])

      const labelEvery = Math.max(1, Math.ceil(points.length / 6))
      plotted.forEach((point, index) => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.isProvisional ? 4.5 : 4, 0, Math.PI * 2)
        ctx.fillStyle = point.isProvisional ? '#fffdf8' : '#b8664f'
        ctx.fill()
        ctx.strokeStyle = '#b8664f'
        ctx.lineWidth = 2
        ctx.stroke()

        if (index % labelEvery === 0 || index === plotted.length - 1) {
          ctx.fillStyle = '#77685d'
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(this._formatMonthLabel(point.month), point.x, height - 14)
        }
      })
    },

    _currentMonth() {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    },

    _formatRmb(value) {
      const amount = numberValue(value)
      const sign = amount < 0 ? '-' : ''
      const absolute = Math.abs(amount)
      if (absolute >= 10000) {
        return `${sign}¥ ${this._trimNumber(absolute / 10000, 2)} 万`
      }
      return `${sign}¥ ${this._withThousands(this._trimNumber(absolute, absolute % 1 ? 2 : 0))}`
    },

    _formatAxis(value) {
      const absolute = Math.abs(value)
      const sign = value < 0 ? '-' : ''
      if (absolute >= 10000) return `${sign}${this._trimNumber(absolute / 10000, 1)}万`
      if (absolute >= 1000) return `${sign}${this._trimNumber(absolute / 1000, 1)}k`
      return `${sign}${Math.round(absolute)}`
    },

    _trimNumber(value, digits = 1) {
      return Number(value).toFixed(digits).replace(/\.?0+$/, '')
    },

    _withThousands(value) {
      const parts = String(value).split('.')
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return parts.join('.')
    },

    _formatDateTime(value) {
      if (!value) return '还没有快照'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${date.getFullYear()}.${month}.${day} ${hour}:${minute}`
    },

    _formatMonthLabel(month) {
      if (!month) return ''
      const parts = String(month).split('-')
      return parts.length >= 2 ? `${Number(parts[1])}月` : String(month)
    }
  }
})
