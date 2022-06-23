<template>
  <k-comment v-if="!validate(resolved)" type="warning">
    部分配置项无法正常显示，这可能并非预期行为<slot name="hint"></slot>。
  </k-comment>

  <form class="k-form">
    <h2 v-if="showHeader ?? !hasTitle(resolved, true)">基础设置</h2>
    <slot name="prolog"></slot>
    <k-schema
      v-model="config"
      :instant="instant"
      :initial="initial"
      :schema="resolved"
      :disabled="disabled"
    ></k-schema>
    <slot name="epilog"></slot>
  </form>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import { hasTitle, Schema, validate } from './utils'

const props = defineProps({
  schema: {} as PropType<Schema>,
  initial: {},
  modelValue: {},
  disabled: Boolean,
  showHeader: {},
  instant: Boolean,
})

const resolved = computed(() => {
  return props.schema && new Schema(props.schema)
})

const emit = defineEmits(['update:modelValue'])

const config = computed({
  get: () => props.modelValue,
  set: emit.bind(null, 'update:modelValue'),
})

</script>

<style lang="scss">

.k-form {
  margin-bottom: 2rem;

  h2 {
    font-size: 1.25rem;

    .k-button {
      float: right;
      transform: translateY(-3px);
    }
  }
}

</style>
