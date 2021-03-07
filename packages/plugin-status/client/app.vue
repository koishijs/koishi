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

if (import.meta.hot) {
  import.meta.hot.on('update', (data) => {
    console.log('update', data)
  })
}

onMounted(async () => {
  const res = await fetch(KOISHI_SERVER + '/_')
  const data = await res.json()
  status.value = data
  console.log('fetch', data)
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
