Component({
  properties: {
    items: { type: Array, value: [] },
    value: { type: String, value: '' }
  },
  methods: {
    onChange(e) {
      this.triggerEvent('change', { value: e.currentTarget.dataset.value })
    }
  }
})
