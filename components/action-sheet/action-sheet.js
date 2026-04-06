Component({
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' }
  },
  methods: {
    onEdit() {
      this.triggerEvent('edit')
    },
    onDelete() {
      this.triggerEvent('delete')
    },
    onCancel() {
      this.triggerEvent('cancel')
    }
  }
})
