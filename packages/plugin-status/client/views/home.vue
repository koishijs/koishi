<template>
  <k-layout v-if="status">
    <load-chart :status="status"/>
    <bot-table :status="status"/>
    <history-chart :status="status"/>
    <hour-chart :status="status"/>
    <group-chart :status="status"/>
    <word-cloud :status="status"/>
  </k-layout>
</template>

<script setup lang="ts">

import { useStatus, BotTable, GroupChart, HistoryChart, HourChart, LoadChart, WordCloud } from '..'

const status = useStatus()

</script>
