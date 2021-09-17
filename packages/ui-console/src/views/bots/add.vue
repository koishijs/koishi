<template>
  <div class="add-bot">
    <h3 class="required">选择适配器</h3>
    <div class="platform-select">
      <el-select v-model="platform" @change="protocol = null, config = {}">
        <el-option v-for="(_, name) in adapters" :value="name"></el-option>
      </el-select>
      <el-select v-if="adapters[platform]?.length" v-model="protocol" @change="config = {}">
        <el-option v-for="(name) in adapters[platform]" :value="name"></el-option>
      </el-select>
    </div>
    <k-schema v-if="selected" :schema="selected" v-model="config"></k-schema>
  </div>
</template>

<script lang="ts" setup>

import { ElSelect, ElOption } from 'element-plus'
import { ref, computed } from 'vue'
import { registry } from '~/client'
import type { Dict, Schema } from '~/server'

const platform = ref<string>()
const protocol = ref<string>()
const config = ref({})

const selected = computed<Schema>(() => {
  if (!platform.value) return
  if (protocol.value) return registry.value[''].protocols[`${platform.value}.${protocol.value}`]
  if (adapters.value[platform.value].length) return
  return registry.value[''].protocols[platform.value]
})

const adapters = computed(() => {
  const result: Dict<string[]> = {}
  for (const key in registry.value[''].protocols) {
    const [platform, protocol] = key.split('.')
    if (protocol) {
      result[platform].push(protocol)
    } else {
      result[key] = []
    }
  }
  return result
})

</script>

<style lang="scss">

.add-bot {
  h3 {
    font-size: 1.125em;
    margin: 0.25rem 0;
    position: relative;
  }

  h3.required::before {
    content: '*';
    position: absolute;
    left: -1.25rem;
    color: var(--error);
  }
}

</style>
