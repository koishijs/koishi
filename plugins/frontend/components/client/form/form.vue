<template>
  <k-comment v-if="!schema" type="warning">
    此插件未声明配置项，这可能并非预期行为，请联系插件作者。
  </k-comment>
  <k-comment v-else-if="!isValid(schema)" type="warning">
    部分配置项无法正常显示，这可能并非预期行为，请联系插件作者。
  </k-comment>
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
  if (schema.type === 'object') return Object.keys(schema.dict).length && !schema.meta.description
  if (schema.type === 'intersect') return isHeadless(schema.list[0])
  return true
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
  h2 {
    font-size: 1.25rem;
  }
}

</style>
