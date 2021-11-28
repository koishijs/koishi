<template>
  <div class="add-bot">
    <k-button solid @click="send('bot/create', { platform: selected[0], protocol: selected[1], config })">启动</k-button>
    <h3 class="required">选择适配器</h3>
    <div class="platform-select">
      <el-cascader v-model="selected" :options="options"></el-cascader>
    </div>
    <k-schema v-if="schema" :schema="schema" v-model="config"></k-schema>
    {{ config }}
  </div>
</template>

<script lang="ts" setup>

import { ref, computed } from 'vue'
import { store, send } from '~/client'
import { KSchema } from '../components'
import type { Schema } from 'koishi'

const config = ref({})
const selected = ref([])

const options = computed(() => {
  return Object.entries(store.protocols).map(([key, schema]) => ({
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
  const schema = store.protocols[platform]
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
