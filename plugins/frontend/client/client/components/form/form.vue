<template>
  <k-comment v-if="!isValid(schema)" type="warning">
    部分配置项无法正常显示，这可能并非预期行为<slot name="hint"></slot>。
  </k-comment>
  <form class="k-form">
    <h2 v-if="showHeader ?? !hasTitle(schema)">基础设置</h2>
    <slot name="prolog"></slot>
    <k-schema v-if="schema" :schema="schema" :disabled="disabled" v-model="config"></k-schema>
    <slot name="epilog"></slot>
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

function hasTitle(schema: Schema) {
  if (!schema) return true
  if (schema.type === 'object') {
    if (schema.meta.description) return true
    const keys = Object.keys(schema.dict)
    if (!keys.length) return true
    return hasTitle(schema.dict[keys[0]])
  } else if (schema.type === 'intersect') {
    return hasTitle(schema.list[0])
  } else {
    return false
  }
}

const primitive = ['string', 'number', 'boolean']
const dynamic = ['function', 'transform']

function isValid(schema: Schema) {
  if (!schema || schema.meta.hidden) return true
  if (primitive.includes(schema.type)) {
    return true
  } else if (['array', 'dict'].includes(schema.type)) {
    return primitive.includes(schema.inner.type)
  } else if (schema.type === 'object') {
    return Object.values(schema.dict).every(isValid)
  } else if (schema.type === 'intersect') {
    return schema.list.every(isValid)
  } else if (schema.type === 'union') {
    const choices = schema.list.filter(item => !dynamic.includes(item.type))
    return choices.length === 1 && isValid(choices[0]) || choices.every(item => item.type === 'const')
  } else {
    return false
  }
}

</script>

<style lang="scss">

.k-form {
  margin-bottom: 2rem;

  h2 {
    font-size: 1.25rem;
  }
}

</style>
