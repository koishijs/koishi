<template>
  <template v-if="status">
    <el-card header="负载状态" shadow="hover">
      <load-bar title="CPU" :rate="status.cpu"/>
      <load-bar title="内存" :rate="status.memory"/>
    </el-card>
    <bot-table :bots="status.bots"/>
    <el-card header="插件列表" shadow="hover">
      <ul class="plugin-list">
        <plugin-view :data="data" v-for="(data, index) in status.plugins" :key="index"/>
      </ul>
    </el-card>
  </template>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'
import type { Payload } from '@/server'
import LoadBar from './components/load-bar.vue'
import BotTable from './components/bot-table.vue'
import PluginView from './components/plugin-view.vue'

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
