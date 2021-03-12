<template>
  <template v-if="status">
    <load-chart :status="status"/>
    <bot-table :status="status"/>
    <plugin-list :status="status"/>
    <history-chart :status="status"/>
    <hour-chart :status="status"/>
    <group-chart :status="status"/>
  </template>
</template>

<script setup lang="ts">

import { useStatus, BotTable, GroupChart, HistoryChart, HourChart, LoadChart, PluginList } from '.'

const status = useStatus()

</script>

<style lang="scss">

body {
  padding: 0;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

</style>
