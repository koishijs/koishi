<template>
  <template v-if="status">
    <load-chart :status="status"/>
    <bot-table :status="status"/>
    <history-chart :status="status"/>
    <hour-chart :status="status"/>
    <group-chart :status="status"/>
    <word-cloud :status="status"/>
  </template>
</template>

<script setup lang="ts">

import { status, BotTable, GroupChart, HistoryChart, HourChart, LoadChart, WordCloud } from '..'

</script>
