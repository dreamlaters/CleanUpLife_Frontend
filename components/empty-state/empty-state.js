Component({
  properties: {
    show: { type: Boolean, value: false },
    icon: { type: String, value: '📭' },
    title: { type: String, value: '' },
    text: { type: String, value: '' },
    buttonText: { type: String, value: '' }
  },
  methods: {
    onButtonTap() {
      this.triggerEvent('buttontap')
    }
  }
})
