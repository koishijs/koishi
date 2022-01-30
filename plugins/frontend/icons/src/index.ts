import { App, camelize, capitalize, defineComponent, h } from 'vue'
import Book from './svg/book.vue'
import CheckCircle from './svg/check-circle.vue'
import ClipboardList from './svg/clipboard-list.vue'
import ExclamationCircle from './svg/exclamation-circle.vue'
import External from './svg/external.vue'
import EyeSlash from './svg/eye-slash.vue'
import Eye from './svg/eye.vue'
import HeartEmpty from './svg/heart-empty.vue'
import HeartFull from './svg/heart-full.vue'
import InfoCircle from './svg/info-circle.vue'
import LayerGroup from './svg/layer-group.vue'
import Link from './svg/link.vue'
import Robot from './svg/robot.vue'
import Search from './svg/search.vue'
import StarEmpty from './svg/star-empty.vue'
import StarFull from './svg/star-full.vue'
import TimesCircle from './svg/times-circle.vue'
import Tools from './svg/tools.vue'

import './style.scss'

export {
  Book,
  CheckCircle,
  ClipboardList,
  ExclamationCircle,
  External,
  EyeSlash,
  Eye,
  HeartEmpty,
  HeartFull,
  InfoCircle,
  LayerGroup,
  Link,
  Robot,
  Search,
  StarEmpty,
  StarFull,
  TimesCircle,
  Tools,
}

import * as icons from '.'

export default function (app: App) {
  app.component('k-icon', defineComponent({
    props: {
      name: String,
    },
    render(props) {
      const name = capitalize(camelize(props.name))
      return h(icons[name])
    },
  }))
}
