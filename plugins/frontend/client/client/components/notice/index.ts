import { App } from 'vue'
import Badge from './badge.vue'
import Comment from './comment.vue'
import Hint from './hint.vue'
import Markdown from './markdown.vue'

export default function (app: App) {
  app.component('k-badge', Badge)
  app.component('k-comment', Comment)
  app.component('k-hint', Hint)
  app.component('k-markdown', Markdown)
}
