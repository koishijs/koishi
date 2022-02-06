import { App } from 'vue'
import CardAside from './card-aside.vue'
import CardNumeric from './card-numeric.vue'
import Card from './card.vue'
import Content from './content.vue'
import Markdown from './markdown.vue'
import TabGroup from './tab-group.vue'
import TabItem from './tab-item.vue'

export default function (app: App) {
  app.component('k-card-aside', CardAside)
  app.component('k-card-numeric', CardNumeric)
  app.component('k-card', Card)
  app.component('k-content', Content)
  app.component('k-markdown', Markdown)
  app.component('k-tab-group', TabGroup)
  app.component('k-tab-item', TabItem)
}
