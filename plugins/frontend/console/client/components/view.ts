import { views } from '../client'
import { defineComponent, h } from 'vue'

export default defineComponent({
  props: {
    name: String,
  },
  setup(props) {
    return () => (views[props.name] || []).map(view => h(view.component))
  },
})
