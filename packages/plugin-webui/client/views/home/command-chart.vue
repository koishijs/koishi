<template>
  <k-card class="frameless" title="指令调用频率">
    <k-chart v-if="Object.keys(stats.commands).length" :option="option" autoresize/>
    <p v-else>暂无数据。</p>
  </k-card>
</template>

<script lang="ts" setup>

import { stats } from '~/client'
import { computed } from 'vue'

const option = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter({ data }) {
      const output = [data.name]
      output.push(`日均调用：${data.value}`)
      return output.join('<br>')
    },
  },
  series: [{
    type: 'pie',
    data: Object.entries(stats.value.commands)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    radius: ['35%', '65%'],
    minShowLabelAngle: 3,
  }],
}))

</script>
