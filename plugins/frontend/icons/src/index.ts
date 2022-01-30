import { App, Component, defineComponent, h } from 'vue'
import ArrowDown from './svg/arrow-down.vue'
import ArrowLeft from './svg/arrow-left.vue'
import ArrowRight from './svg/arrow-right.vue'
import ArrowUp from './svg/arrow-up.vue'
import Book from './svg/book.vue'
import CheckFull from './svg/check-full.vue'
import ChevronDown from './svg/chevron-down.vue'
import ChevronLeft from './svg/chevron-left.vue'
import ChevronRight from './svg/chevron-right.vue'
import ChevronUp from './svg/chevron-up.vue'
import ClipboardList from './svg/clipboard-list.vue'
import CommentsFull from './svg/comments-full.vue'
import Diagram from './svg/diagram.vue'
import ExclamationFull from './svg/exclamation-full.vue'
import Expand from './svg/expand.vue'
import External from './svg/external.vue'
import EyeSlash from './svg/eye-slash.vue'
import Eye from './svg/eye.vue'
import Filter from './svg/filter.vue'
import HeartEmpty from './svg/heart-empty.vue'
import HeartFull from './svg/heart-full.vue'
import InfoFull from './svg/info-full.vue'
import LayerGroup from './svg/layer-group.vue'
import Link from './svg/link.vue'
import Moon from './svg/moon.vue'
import Puzzle from './svg/puzzle.vue'
import QuestionEmpty from './svg/question-empty.vue'
import Redo from './svg/redo.vue'
import Robot from './svg/robot.vue'
import Search from './svg/search.vue'
import SearchMinus from './svg/search-minus.vue'
import SearchPlus from './svg/search-plus.vue'
import StarEmpty from './svg/star-empty.vue'
import StarFull from './svg/star-full.vue'
import Sun from './svg/sun.vue'
import TimesFull from './svg/times-full.vue'
import Tools from './svg/tools.vue'
import Undo from './svg/undo.vue'

import './style.scss'

const icons: Record<string, Component> = {}

register('arrow-down', ArrowDown)
register('arrow-left', ArrowLeft)
register('arrow-right', ArrowRight)
register('arrow-up', ArrowUp)
register('book', Book)
register('check-full', CheckFull)
register('chevron-down', ChevronDown)
register('chevron-left', ChevronLeft)
register('chevron-right', ChevronRight)
register('chevron-up', ChevronUp)
register('clipboard-list', ClipboardList)
register('comments-full', CommentsFull)
register('diagram', Diagram)
register('exclamation-full', ExclamationFull)
register('expand', Expand)
register('external', External)
register('eye-slash', EyeSlash)
register('eye', Eye)
register('filter', Filter)
register('heart-empty', HeartEmpty)
register('heart-full', HeartFull)
register('info-full', InfoFull)
register('layer-group', LayerGroup)
register('link', Link)
register('moon', Moon)
register('puzzle', Puzzle)
register('question-empty', QuestionEmpty)
register('redo', Redo)
register('robot', Robot)
register('search', Search)
register('search-minus', SearchMinus)
register('search-plus', SearchPlus)
register('star-empty', StarEmpty)
register('star-full', StarFull)
register('sun', Sun)
register('times-full', TimesFull)
register('tools', Tools)
register('undo', Undo)

export function register(name: string, component: Component) {
  icons[name] = component
}

export default function (app: App) {
  app.component('k-icon', defineComponent({
    props: {
      name: String,
    },
    render(props) {
      return h(icons[props.name])
    },
  }))
}
