import { ref, onMounted } from 'vue'
import type { Payload } from '~/server'
import BotTable from './components/bot-table.vue'
import GroupChart from './components/group-chart.vue'
import HistoryChart from './components/history-chart.vue'
import HourChart from './components/hour-chart.vue'
import LoadChart from './components/load-chart.vue'
import PluginList from './components/plugin-list.vue'
import WordCloud from './components/word-cloud.vue'

export {
  BotTable,
  GroupChart,
  HistoryChart,
  HourChart,
  LoadChart,
  PluginList,
  WordCloud,
}

export function useStatus() {
  const status = ref<Payload>(null)

  onMounted(async () => {
    const socket = new WebSocket(KOISHI_ENDPOINT)
    socket.onmessage = (ev) => {
      const data = JSON.parse(ev.data)
      console.log('receive', data)
      if (data.type === 'update') {
        status.value = data.body
      }
    }
  })

  return status
}
