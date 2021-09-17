<template>
  <div class="plugin-select">
    <div class="content">
      <t-choice class="group" :data="registry[0]" v-model="model"/>
      <div class="group">
        运行中的插件
        <k-hint placement="right">
          <b>为什么一些插件没有显示？</b>
          <br>这里只展示直接从 app 注册的具名插件。换言之，在其他插件内部注册的插件或没有提供 name 的插件将不予显示。
        </k-hint>
      </div>
      <t-choice v-for="data in registry.filter(data => data.id)" :data="data" v-model="model"/>
      <div class="group">
        未运行的插件
        <k-hint placement="right" icon="fas fa-filter" :class="{ filtered }" @click="filtered = !filtered">
          <template v-if="filtered">
            <b>筛选：开启</b><br>只显示支持在线配置的插件。
          </template>
          <template v-else>
            <b>筛选：关闭</b><br>显示所有可用插件。
          </template>
        </k-hint>
      </div>
      <t-choice v-for="data in available.filter(data => !filtered || data.schema)" :data="data" v-model="model"/>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { registry } from '~/client'
import { ref, computed } from 'vue'
import { Data, available } from './shared'
import TChoice from './choice.vue'

const props = defineProps<{
  modelValue: Data
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

const filtered = ref(false)

</script>

<style lang="scss">

.plugin-select {
  width: 16rem;
  height: 100%;
  border-right: 1px solid var(--border);
  overflow: auto;

  .content {
    padding: 1rem 0;
    line-height: 2.25rem;
  }

  .group {
    padding: 0 2rem !important;
    font-weight: bold;
  }

  .group:not(.t-choice) {
    margin-top: 0.5rem;
  }

  .fa-filter {
    font-size: 0.9em;
    cursor: pointer;

    &:active, &.filtered {
      opacity: 1;
    }

    &:active {
      color: var(--fg0);
    }
  }
}

</style>
