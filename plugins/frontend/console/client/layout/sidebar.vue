<template>
  <aside class="layout-aside">
    <div class="top">
      <h1>Koishi 控制台</h1>
      <template v-for="({ name, path, meta }) in getRoutes('top')" :key="name">
        <router-link class="k-menu-item" :to="{ path, query: queries[path] }">
          <k-icon :name="meta.icon"/>
          {{ name }}
          <span class="badge" v-if="meta.badge?.()">{{ meta.badge?.() }}</span>
        </router-link>
      </template>
    </div>
    <div class="bottom">
      <div class="k-menu-item" @click="toggle">
        <k-icon :name="isDark ? 'moon' : 'sun'"/>
        {{ isDark ? '夜间模式' : '明亮模式' }}
      </div>
      <template v-for="({ name, path, meta }) in getRoutes('bottom')" :key="name">
        <router-link class="k-menu-item" :to="{ path, query: queries[path] }">
          <k-icon :name="meta.icon"/>
          {{ name }}
          <span class="badge" v-if="meta.badge?.()">{{ meta.badge?.() }}</span>
        </router-link>
      </template>
    </div>
  </aside>
</template>

<script lang="ts" setup>

import { useRouter } from 'vue-router'
import { useDark } from '@vueuse/core'
import { reactive } from 'vue'
import { routes } from '../client'

const router = useRouter()

const queries = reactive({})

router.afterEach(() => {
  const { path, query } = router.currentRoute.value
  queries[path] = query
})

function getRoutes(position: 'top' | 'bottom') {
  return routes.value.filter(r => r.meta.position === position).sort((a, b) => b.meta.order - a.meta.order)
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
    background-color: var(--primary);
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
    background-color: var(--error);
    top: 50%;
    right: 1.5rem;
    transform: translateY(-50%);
    line-height: 1;
    padding: 4px 8px;
    font-size: 0.875rem;
    font-weight: normal;
    color: var(--bg0);
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
