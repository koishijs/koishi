import { reactive } from 'vue'

export const shared = reactive({
  showOverlay: false,
  overlayImage: null as HTMLImageElement,
})
