<template>
  <tr class="dep-package-view">
    <td class="name" :class="state">{{ name }}</td>
    <td class="current">
      <template v-if="local">
        {{ local.resolved }}
        <template v-if="local.workspace">(工作区)</template>
        <template v-else-if="local.resolved === versions[0]?.version">(最新)</template>
      </template>
      <span v-else>-</span>
    </td>
    <td class="target">
      <template v-if="local?.workspace">
        <k-button class="action" @click="send('market/patch', name, null)">移除依赖</k-button>
      </template>
      <template v-else>
        <k-button class="prefix right-adjacent" @click="prefix = matrix[prefix]">{{ prefix || '=' }}</k-button>
        <el-select class="left-adjacent" v-model="value">
          <el-option value="">移除依赖</el-option>
          <el-option v-for="({ version }) in versions" :key="version" :value="version"></el-option>
        </el-select>
      </template>
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
    return target === '' ? '移除依赖' : target?.replace(/^[\^~]/, '')
  },
  set(target: string) {
    if (target === '' && !local.value) {
      delete config.override[props.name]
    } else {
      config.override[props.name] = prefix.value + target
      if (config.override[props.name] === local.value?.request) {
        delete config.override[props.name]
      }
    }
  },
})

const prefix = computed({
  get() {
    return /^[\^~]?/.exec(config.override[props.name] || local.value.request)[0]
  },
  set(prefix: string) {
    config.override[props.name] = prefix + (config.override[props.name] || local.value.request).replace(/^[\^~]/, '')
    if (config.override[props.name] === local.value?.request) {
      delete config.override[props.name]
    }
  },
})

const matrix = { '': '^', '^': '~', '~': '' }

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

const versions = computed(() => {
  return store.market[props.name]?.versions || []
})

</script>

<style lang="scss" scoped>

.dep-package-view {
  height: 3rem;
  position: relative;

  td.name {
    text-align: left;
    padding-left: 3.6rem;

    &::before {
      content: '';
      position: absolute;
      border-radius: 100%;
      width: 0.5rem;
      height: 0.5rem;
      top: 50%;
      left: 1.8rem;
      transform: translate(-50%, -50%);
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

  .k-button.action {
    width: 10rem;
  }

  .el-select {
    width: 8rem;
  }

  .k-button.prefix {
    width: 2rem;
    height: 2rem;
    vertical-align: bottom;
    padding: 0;
  }
}

</style>
