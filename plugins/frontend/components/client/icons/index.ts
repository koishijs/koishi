import { App, Component, defineComponent, h } from 'vue'
import Application from './svg/application.vue'
import ArrowDown from './svg/arrow-down.vue'
import ArrowLeft from './svg/arrow-left.vue'
import ArrowRight from './svg/arrow-right.vue'
import ArrowUp from './svg/arrow-up.vue'
import Balance from './svg/balance.vue'
import Book from './svg/book.vue'
import BoxOpen from './svg/box-open.vue'
import CheckFull from './svg/check-full.vue'
import ChevronDown from './svg/chevron-down.vue'
import ChevronLeft from './svg/chevron-left.vue'
import ChevronRight from './svg/chevron-right.vue'
import ChevronUp from './svg/chevron-up.vue'
import ClipboardList from './svg/clipboard-list.vue'
import Cog from './svg/cog.vue'
import CommentsFull from './svg/comments-full.vue'
import Database from './svg/database.vue'
import Diagram from './svg/diagram.vue'
import ExclamationFull from './svg/exclamation-full.vue'
import Expand from './svg/expand.vue'
import External from './svg/external.vue'
import EyeSlash from './svg/eye-slash.vue'
import Eye from './svg/eye.vue'
import FileArchive from './svg/file-archive.vue'
import Filter from './svg/filter.vue'
import Flask from './svg/flask.vue'
import Hdd from './svg/hdd.vue'
import HeartEmpty from './svg/heart-empty.vue'
import HeartFull from './svg/heart-full.vue'
import History from './svg/history.vue'
import InfoFull from './svg/info-full.vue'
import Koishi from './svg/koishi.vue'
import LayerGroup from './svg/layer-group.vue'
import Link from './svg/link.vue'
import Moon from './svg/moon.vue'
import PaperPlane from './svg/paper-plane.vue'
import PuzzlePiece from './svg/puzzle-piece.vue'
import QuestionEmpty from './svg/question-empty.vue'
import Redo from './svg/redo.vue'
import Robot from './svg/robot.vue'
import Search from './svg/search.vue'
import SearchMinus from './svg/search-minus.vue'
import SearchPlus from './svg/search-plus.vue'
import StarEmpty from './svg/star-empty.vue'
import StarFull from './svg/star-full.vue'
import Sun from './svg/sun.vue'
import Tachometer from './svg/tachometer.vue'
import Tag from './svg/tag.vue'
import TimesFull from './svg/times-full.vue'
import Tools from './svg/tools.vue'
import Undo from './svg/undo.vue'
import Users from './svg/users.vue'
import User from './svg/user.vue'

import './style.scss'

const icons: Record<string, Component> = {}

registerIcon('application', Application)
registerIcon('arrow-down', ArrowDown)
registerIcon('arrow-left', ArrowLeft)
registerIcon('arrow-right', ArrowRight)
registerIcon('arrow-up', ArrowUp)
registerIcon('balance', Balance)
registerIcon('book', Book)
registerIcon('box-open', BoxOpen)
registerIcon('check-full', CheckFull)
registerIcon('chevron-down', ChevronDown)
registerIcon('chevron-left', ChevronLeft)
registerIcon('chevron-right', ChevronRight)
registerIcon('chevron-up', ChevronUp)
registerIcon('clipboard-list', ClipboardList)
registerIcon('cog', Cog)
registerIcon('comments-full', CommentsFull)
registerIcon('database', Database)
registerIcon('diagram', Diagram)
registerIcon('exclamation-full', ExclamationFull)
registerIcon('expand', Expand)
registerIcon('external', External)
registerIcon('eye-slash', EyeSlash)
registerIcon('eye', Eye)
registerIcon('file-archive', FileArchive)
registerIcon('filter', Filter)
registerIcon('flask', Flask)
registerIcon('hdd', Hdd)
registerIcon('heart-empty', HeartEmpty)
registerIcon('heart-full', HeartFull)
registerIcon('history', History)
registerIcon('info-full', InfoFull)
registerIcon('koishi', Koishi)
registerIcon('layer-group', LayerGroup)
registerIcon('link', Link)
registerIcon('moon', Moon)
registerIcon('paper-plane', PaperPlane)
registerIcon('puzzle-piece', PuzzlePiece)
registerIcon('question-empty', QuestionEmpty)
registerIcon('redo', Redo)
registerIcon('robot', Robot)
registerIcon('search', Search)
registerIcon('search-minus', SearchMinus)
registerIcon('search-plus', SearchPlus)
registerIcon('star-empty', StarEmpty)
registerIcon('star-full', StarFull)
registerIcon('sun', Sun)
registerIcon('tachometer', Tachometer)
registerIcon('tag', Tag)
registerIcon('times-full', TimesFull)
registerIcon('tools', Tools)
registerIcon('undo', Undo)
registerIcon('users', Users)
registerIcon('user', User)

export function registerIcon(name: string, component: Component) {
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
