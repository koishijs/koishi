<template>
  <el-scrollbar class="plugin-select">
    <div class="content">
      <k-tab-item class="k-tab-group-title" label="" v-model="model">
        全局设置
      </k-tab-item>
      <k-tab-group :data="Object.values(registry).filter(item => item.id)" :label="getLabel" :readonly="getReadonly" v-model="model">
        运行中的插件
        <k-hint placement="right">
          <b>为什么一些插件没有显示？</b>
          <br>这里只展示直接从 app 注册的具名插件。换言之，在其他插件内部注册的插件或没有提供 name 的插件将不予显示。
        </k-hint>
      </k-tab-group>
      <k-tab-group :data="available.filter(data => !filtered || data.schema)" :label="getLabel" :readonly="getReadonly" v-model="model">
        未运行的插件
        <k-hint placement="right" icon="fas fa-filter" :class="{ filtered }" @click="filtered = !filtered">
          <template v-if="filtered">
            <b>筛选：开启</b><br>只显示支持在线配置的插件。
          </template>
          <template v-else>
            <b>筛选：关闭</b><br>显示所有可用插件。
          </template>
        </k-hint>
      </k-tab-group>
    </div>
  </el-scrollbar>
</template>

<script lang="ts" setup>

import { store } from '~/client'
import { ref, computed } from 'vue'
import { available } from './shared'

const props = defineProps<{
  modelValue: string
}>()

const emits = defineEmits(['update:modelValue'])

const registry = computed(() => store.registry)

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

const filtered = ref(false)

const getLabel = item => item.name
const getReadonly = item => !item.schema

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
