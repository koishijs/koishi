<template>
  <el-card v-if="status" header="负载">
    <load-bar :status="status"/>
  </el-card>
  <el-card v-if="status" header="插件">
    <ul class="plugin-list">
      <plugin-view :data="data" v-for="(data, index) in status.plugins" :key="index"/>
    </ul>
  </el-card>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'
import PluginView from './components/plugin-view.vue'
import LoadBar from './components/load-bar.vue'

interface PluginData {
  name: string
  disposable: boolean
  children: PluginData[]
}

interface Status {
  plugins: PluginData[]
}

const status = ref<Status>(null)

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

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
}

</style>
