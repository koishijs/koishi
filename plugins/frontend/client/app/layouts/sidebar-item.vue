<template>
  <router-link class="k-menu-item" :to="target">
    <k-icon :name="route.meta.icon || 'application'"/>
    {{ route.name }}
    <span class="badge" v-if="badge">{{ badge }}</span>
  </router-link>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import { RouteRecordNormalized } from 'vue-router'
import { routeCache } from './utils'

const props = defineProps({
  route: {} as PropType<RouteRecordNormalized>,
})

const target = computed(() => {
  return routeCache[props.route.name] || props.route.path.replace(/:.+/, '')
})

const badge = computed(() => {
  return props.route.meta.badge.reduce((prev, curr) => prev + curr(), 0)
})

</script>
