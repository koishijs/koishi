<template>
  <div class="add-bot">
    <k-button solid @click="send('bot/create', { platform, protocol, config })">启动</k-button>
    <h3 class="required">选择适配器</h3>
    <div class="platform-select">
      <el-select v-model="platform" @change="protocol = null, config = {}">
        <el-option v-for="(_, name) in registry[''].protocols" :value="name"></el-option>
      </el-select>
      <el-select v-if="schema1?.type === 'decide'" v-model="protocol" @change="config = {}">
        <el-option v-for="(_, name) in schema1.dict" :value="name"></el-option>
      </el-select>
    </div>
    <k-schema v-if="selected" :schema="selected" v-model="config"></k-schema>
  </div>
</template>

<script lang="ts" setup>

import { ElSelect, ElOption } from 'element-plus'
import { ref, computed } from 'vue'
import { registry, send } from '~/client'
import type { Schema } from '~/server'

const platform = ref<string>()
const protocol = ref<string>()
const config = ref({})

const schema1 = computed<Schema>(() => {
  if (!platform.value) return
  return registry.value[''].protocols[platform.value]
})

const selected = computed<Schema>(() => {
  if (!schema1.value) return
  if (schema1.value.type !== 'decide') return schema1.value
  if (protocol.value) return schema1.value.dict[protocol.value]
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
