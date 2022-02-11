<template>
  <tr>
    <td>{{ name }}</td>
    <td>{{ current || '-' }}{{ current === remote[0].version ? ' (最新)' : '' }}</td>
    <td>
      <el-select v-model="value">
        <el-option value="">移除插件</el-option>
        <el-option
          v-for="({ version }) in remote"
          :key="version" :value="version"
        >{{ version }}{{ version === current ? ' (当前)' : '' }}</el-option>
      </el-select>
    </td>
  </tr>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { store } from '~/client'
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
    if (target === '' && !current.value || target === current.value) {
      delete config.override[props.name]
    } else {
      config.override[props.name] = target
    }
  },
})

const current = computed(() => {
  return store.packages[props.name]?.version
})

const remote = computed(() => {
  return store.market[props.name].versions
})

</script>
