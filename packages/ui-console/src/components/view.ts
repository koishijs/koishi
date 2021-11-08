import { views } from '..'
import { defineComponent, h } from 'vue'

export default defineComponent({
  props: {
    name: String,
  },
  setup(props) {
    return () => (views.value[props.name] || []).map(view => h(view.component))
  },
})
