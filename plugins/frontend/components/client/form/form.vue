<template>
  <form class="k-form">
    <h2 v-if="showHeader ?? isHeadless(schema)">基础设置</h2>
    <slot name="header"></slot>
    <k-schema v-if="schema" :schema="schema" :disabled="disabled" v-model="config"></k-schema>
    <slot name="footer"></slot>
  </form>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import Schema from 'schemastery'

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
  disabled: Boolean,
  showHeader: {},
})

const emit = defineEmits(['update:modelValue'])

const config = computed({
  get: () => props.modelValue,
  set: emit.bind(null, 'update:modelValue'),
})

function isHeadless(schema: Schema) {
  if (!schema) return false
  if (schema.type === 'object') return !schema.meta.description
  if (schema.type === 'intersect') return isHeadless(schema.list[0])
  return true
}

</script>

<style lang="scss">

.k-form {
  h2 {
    font-size: 1.25rem;
  }
}

</style>
