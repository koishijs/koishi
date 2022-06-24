<template>
  <h1 class="config-header">
    <span class="left">
      <template v-if="current.path">
        分组<k-alias :current="current"></k-alias>
      </template>
      <template v-else>{{ current.label }}</template>
    </span>
    <span class="right">
      <k-button solid @click="addItem(current.path, 'unload', '')">添加插件</k-button>
      <k-button solid @click="addItem(current.path, 'group', 'group')">添加分组</k-button>
      <k-button v-if="current.path" solid type="error" @click="removeItem(current.path)">移除分组</k-button>
    </span>
  </h1>
  <div class="k-form" v-if="current.config.$isolate?.length">
    <h2>隔离服务</h2>
    <ul>
      <li v-for="name in current.config.$isolate">
        {{ name }} ({{ current.config.$deps[name] ? '已' : '未' }}实现)
      </li>
    </ul>
  </div>
  <!-- <k-form
    v-if="Object.keys(current.config.$deps).length"
    :schema="services.schema"
    :initial="services.initial"
    v-model="services.value"
  ></k-form> -->
  <div class="k-form" v-if="Object.keys(current.config.$filter || {}).length">
    <h2>过滤器</h2>
    <ul>
      <li v-for="(value, key) in current.config.$filter">
        {{ key }}: {{ value }}
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>

import { Schema, clone } from '@koishijs/client'
import { computed, ref, watch } from 'vue'
import { Tree, removeItem, addItem } from './utils'
import KAlias from './alias.vue'

const props = defineProps<{
  current: Tree
}>()

const config = ref()

watch(() => props.current.config, (value) => {
  config.value = clone(value)
}, { immediate: true })

const services = computed(() => {
  const { $deps } = props.current.config
  return Schema.object(Object.fromEntries(Object.keys($deps).map(key => {
    return [key, Schema.boolean()]
  }))).description('隔离服务')
})

const filter = Schema.object({
  user: Schema.array(String).description('用户列表'),
  channel: Schema.array(String).description('频道列表'),
  guild: Schema.array(String).description('群组列表'),
  platform: Schema.array(String).description('平台列表'),
}).description('过滤器')

</script>

<style lang="scss" scoped>

h2 {
  font-size: 1.25rem;
}

</style>
