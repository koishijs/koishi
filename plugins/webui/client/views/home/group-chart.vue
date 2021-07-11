<template>
  <k-card class="frameless" title="各群发言数量">
    <k-chart v-if="stats.groups.length" :option="option" autoresize/>
    <p v-else>暂无数据。</p>
  </k-card>
</template>

<script lang="ts" setup>

import { stats } from '~/client'
import { computed } from 'vue'

const option = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter({ data, value }) {
      const output = [data.name]
      output.push(`平台：${data.platform}`)
      if (data.memberCount) output.push(`人数：${data.memberCount}`)
      if (data.assignee) output.push(`接入：${data.assignee}`)
      output.push(`日均发言：${+value.toFixed(1)}`)
      output.push(`昨日发言：${+data.last.toFixed(1)}`)
      return output.join('<br>')
    },
  },
  series: [{
    type: 'pie',
    data: stats.value.groups.sort((a, b) => b.value - a.value),
    radius: ['35%', '65%'],
    minShowLabelAngle: 3,
  }],
}))

</script>
