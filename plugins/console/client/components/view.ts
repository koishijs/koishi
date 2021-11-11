import { views } from '../client'
import { defineComponent, h } from 'vue'

export default defineComponent({
  props: {
    name: String,
  },
  setup(props) {
    console.log(views)
    return () => (views.value[props.name] || []).map(view => h(view.component))
  },
})
