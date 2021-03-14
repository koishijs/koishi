import { ref } from 'vue'
import type { Payload } from '~/server'
import BotTable from './components/bot-table.vue'
import GroupChart from './components/group-chart.vue'
import HistoryChart from './components/history-chart.vue'
import HourChart from './components/hour-chart.vue'
import LoadChart from './components/load-chart.vue'
import WordCloud from './components/word-cloud.vue'

export {
  BotTable,
  GroupChart,
  HistoryChart,
  HourChart,
  LoadChart,
  WordCloud,
}

export const status = ref<Payload>(null)
