<template>
  <tr class="dep-package-view">
    <td class="name" :class="state">{{ name }}</td>
    <td class="current">
      <template v-if="local">
        {{ local.resolved }}
        <template v-if="local.workspace">(工作区)</template>
        <template v-else-if="local.resolved === remote?.versions[0].version">(最新)</template>
      </template>
      <span v-else>-</span>
    </td>
    <td class="target">
      <template v-if="local?.workspace">
        <k-button @click="send('market/patch', name, null)">移除依赖</k-button>
      </template>
      <el-select v-else v-model="value">
        <el-option value="">移除依赖</el-option>
        <el-option
          v-for="({ version }) in remote?.versions || []"
          :key="version" :value="version"
        >{{ version }}{{ version === local?.resolved ? ' (当前)' : '' }}</el-option>
      </el-select>
    </td>
  </tr>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { send, store } from '@koishijs/client'
import { config } from '../utils'

const props = defineProps({
  name: String,
})

const value = computed({
  get() {
    const target = config.override[props.name]
    return target === '' ? '移除依赖' : target
  },
  set(target: string) {
    if (target === '' && !local.value || target === local.value?.resolved) {
      delete config.override[props.name]
    } else {
      config.override[props.name] = target
    }
  },
})

const state = computed(() => {
  if (!props.name.includes('koishi-plugin-') && !props.name.startsWith('@koishijs/plugin-')) {
    return 'disabled'
  }
  if (store.packages?.[props.name]?.id) return 'success'
  if (local.value) return 'warning'
  return 'error'
})

const local = computed(() => {
  return store.dependencies[props.name]
})

const remote = computed(() => {
  return store.market[props.name]
})

</script>

<style lang="scss">

.dep-package-view {
  height: 3rem;
  position: relative;

  td.name {
    text-align: left;
    padding-left: 4rem;

    &::before {
      content: '';
      position: absolute;
      border-radius: 100%;
      width: 0.5rem;
      height: 0.5rem;
      top: 50%;
      left: 2rem;
      transform: translateY(-50%);
      transition: background-color 0.3s ease;
      box-shadow: 1px 1px 2px #3333;
    }

    // 已加载的插件
    &.success::before {
      background-color: var(--success);
    }
    // 未加载的插件
    &.warning::before {
      background-color: var(--warning);
    }
    // 未安装的插件
    &.error::before {
      background-color: var(--error);
    }
    // 非插件
    &.disabled::before {
      background-color: var(--disabled);
    }
  }

  .el-select, .k-button {
    width: 10rem;
  }
}

</style>
