<template>
  <template v-if="status">
    <load-chart :status="status"/>
    <history-chart :status="status"/>
    <hour-chart :status="status"/>
    <group-chart :status="status"/>
    <word-cloud :status="status"/>
  </template>
</template>

<script setup lang="ts">

import { status } from '~/client'
import GroupChart from './group-chart.vue'
import HistoryChart from './history-chart.vue'
import HourChart from './hour-chart.vue'
import LoadChart from './load-chart.vue'
import WordCloud from './word-cloud.vue'

</script>
