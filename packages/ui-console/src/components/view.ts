import { views } from '..'
import { defineComponent, h } from 'vue'

export default defineComponent({
  props: {
    name: String,
  },
  setup(props) {
    return () => (views[props.name] || []).map(component => h(component))
  },
})
