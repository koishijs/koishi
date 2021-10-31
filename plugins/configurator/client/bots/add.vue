<template>
  <div class="add-bot">
    <k-button solid @click="send('bot/create', { platform: selected[0], protocol: selected[1], config })">启动</k-button>
    <h3 class="required">选择适配器</h3>
    <div class="platform-select">
      <el-cascader v-model="selected" :options="options"></el-cascader>
    </div>
    <k-schema v-if="schema" :schema="schema" v-model="config"></k-schema>
  </div>
</template>

<script lang="ts" setup>

import { ref, computed } from 'vue'
import { store, send } from '~/client'
import type { Registry } from '@koishijs/plugin-configurator/src'
import type { Schema } from '~/server'

const config = ref({})
const selected = ref([])

const appData = computed(() => store.value.registry[''] as Registry.AppData)

const options = computed(() => {
  const { protocols } = appData.value
  return Object.entries(protocols).map(([key, schema]) => ({
    value: key,
    label: key,
    children: schema.type === 'decide' ? Object.keys(schema.dict).map((key) => ({
      value: key,
      label: key,
    })) : null,
  }))
})

const schema = computed<Schema>(() => {
  const [platform, protocol] = selected.value
  if (!platform) return
  const schema = appData.value.protocols[platform]
  if (schema.type !== 'decide') return schema
  if (protocol) return schema.dict[protocol]
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
