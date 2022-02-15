<template>
  <aside class="layout-aside">
    <div class="top">
      <h1>Koishi 控制台</h1>
      <sidebar-item v-for="route in getRoutes('top')" :key="route.name" :route="route"></sidebar-item>
    </div>
    <div class="bottom">
      <div class="k-menu-item" @click="toggle">
        <k-icon :name="isDark ? 'moon' : 'sun'"/>
        {{ isDark ? '夜间模式' : '明亮模式' }}
      </div>
      <sidebar-item v-for="route in getRoutes('bottom')" :key="route.name" :route="route"></sidebar-item>
    </div>
  </aside>
</template>

<script lang="ts" setup>

import { routes, getValue } from '@koishijs/client'
import { useDark } from '@vueuse/core'
import SidebarItem from './sidebar-item.vue'

function getRoutes(position: 'top' | 'bottom') {
  const scale = position === 'top' ? 1 : -1
  return routes.value
    .filter(r => getValue(r.meta.position) === position)
    .sort((a, b) => scale * (b.meta.order - a.meta.order))
}

const isDark = useDark()

function toggle() {
  isDark.value = !isDark.value
}

</script>

<style lang="scss">

aside.layout-aside {
  position: fixed;
  height: 100%;
  z-index: 100;
  width: var(--aside-width);
  background-color: var(--card-bg);
  box-shadow: var(--card-shadow);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: background-color 0.3s ease;

  h1 {
    font-size: 1.5rem;
    text-align: center;
    margin: 1rem 0;
  }

  .k-menu-item {
    font-size: 1.05rem;
    padding: 0 2rem;
    line-height: 3rem;
  }

  $marker-width: 4px;

  .k-menu-item.active::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: $marker-width;
    height: 2rem;
    transform: translateY(-50%);
    display: block;
    border-radius: 0 $marker-width $marker-width 0;
    background-color: var(--active);
    transition: background-color 0.3s ease;
  }

  .k-menu-item .k-icon {
    width: 1.5rem;
    height: 1.25rem;
    margin-right: 0.75rem;
    text-align: center;
    vertical-align: -4px;
  }

  .k-menu-item .badge {
    position: absolute;
    border-radius: 1rem;
    color: #ffffff;
    background-color: var(--error);
    top: 50%;
    right: 1.5rem;
    transform: translateY(-50%);
    line-height: 1;
    padding: 4px 8px;
    font-size: 0.75rem;
    font-weight: bolder;
    transition: 0.3s ease;
  }

  .top {
    margin-top: 0.5rem;
  }

  .bottom {
    margin-bottom: 1rem;
  }
}

</style>
