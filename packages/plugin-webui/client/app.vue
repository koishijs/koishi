<template>
  <el-card header="插件">
    <ul class="plugin-list">
      <plugin-view :data="data" v-for="(data, index) in plugins" :key="index"/>
    </ul>
  </el-card>
</template>

<script setup lang="ts">

import { onMounted, ref } from 'vue'
import PluginView from './components/plugin-view.vue'

interface State {
  name: string
  disposable: boolean
  children: State[]
}

const plugins = ref<State[]>([])

if (import.meta.hot) {
  import.meta.hot.on('registry-update', (data) => {
    console.log('registry-update', data)
  })
}


onMounted(async () => {
  const res = await fetch(KOISHI_SERVER + '/plugins')
  const data = await res.json()
  plugins.value = data
  console.log(data)
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
