<template>
  <sidebar v-if="!sidebarHidden"/>
  <main :class="mainClasses">
    <router-view v-if="loaded" #="{ Component }">
      <keep-alive>
        <component :is="Component"/>
      </keep-alive>
    </router-view>
    <div class="loading" v-else v-loading="true" element-loading-text="正在加载数据……"></div>
  </main>
  <k-view name="global"></k-view>
</template>

<script lang="ts" setup>

import { store } from '@koishijs/client'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './sidebar.vue'

const route = useRoute()

const loaded = computed(() => {
  if (!route.meta.fields) return true
  return route.meta.fields.every((key) => store[key])
})

const mainClasses = computed(() => {
  const result = ['layout-main']
  result.push('route-' + route.path.slice(1).split('/', 1)[0])
  if (sidebarHidden.value) result.push('sidebar-hidden')
  return result
})

const sidebarHidden = computed(() => {
  return route.meta.position === 'hidden'
})

</script>

<style lang="scss">

body {
  margin: 0;
  min-height: 100vh;
  font-family: PingFang SC, Hiragino Sans GB, Microsoft YaHei, SimSun, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--fg1);
  background-color: var(--page-bg);
  position: relative;
  transition: color 0.3s ease, background-color 0.3s ease;
}

a {
  color: inherit;
  text-decoration: none;
  transition: color 0.3s ease;
}

main.layout-main {
  margin-left: var(--aside-width);
  overflow-y: hidden;

  &.sidebar-hidden {
    margin-left: 0;
  }

  .loading {
    height: 100vh;
  }
}

p, ul {
  margin: 1rem 0;
  line-height: 1.7;
}

table {
  text-align: center;
  width: 100%;
  border-collapse: collapse;

  td, th {
    padding: .5em 1em;
  }

  tr {
    border-top: 1px solid var(--border);
    transition: border-color 0.3s ease;
  }

  tr:last-child {
    border-bottom: 1px solid var(--border);
  }
}

</style>
