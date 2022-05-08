import { views } from '..'
import { defineComponent, h } from 'vue'

export default defineComponent({
  props: {
    name: String,
    data: {},
  },
  setup: () => ({ name, data }) => {
    return (views[name] || []).map(view => h(view.component as any, { data }))
  },
})
