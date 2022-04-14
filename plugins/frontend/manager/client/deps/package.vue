<template>
  <tr class="dep-package-view">
    <td class="name" :class="state">{{ name }}</td>
    <td class="current">
      <template v-if="store.dependencies[name]">
        {{ local.version }}
        <template v-if="local?.workspace">(工作区)</template>
        <template v-else-if="local?.version === remote?.versions[0].version">(最新)</template>
      </template>
      <span v-else>-</span>
    </td>
    <td class="target">
      <template v-if="local?.workspace">
        <k-button v-if="store.dependencies[name]" @click="send('market/patch', name, null)">移除依赖</k-button>
        <k-button v-else @click="send('market/patch', name, local.version)">添加依赖</k-button>
      </template>
      <el-select v-else v-model="value">
        <el-option v-if="store.dependencies[name]" value="">移除依赖</el-option>
        <el-option
          v-for="({ version }) in remote?.versions || []"
          :key="version" :value="version"
        >{{ version }}{{ version === local?.version ? ' (当前)' : '' }}</el-option>
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
    return target === '' ? '移除插件' : target
  },
  set(target: string) {
    if (target === '' && !local.value || target === local.value) {
      delete config.override[props.name]
    } else {
      config.override[props.name] = target
    }
  },
})

const state = computed(() => {
  if (store.dependencies[props.name]) return 'tracked'
  if (local.value) return local.value.workspace ? 'workspace' : 'external'
  return 'remote'
})

const local = computed(() => {
  return store.packages[props.name]
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

    &.tracked::before {
      background-color: var(--success);
    }
    &.workspace::before {
      background-color: var(--disabled);
    }
    &.external::before {
      background-color: var(--primary);
    }
    &.remote::before {
      background-color: var(--error);
    }
  }

  .el-select, .k-button {
    width: 10rem;
  }
}

</style>
