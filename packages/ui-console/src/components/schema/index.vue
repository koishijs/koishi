<template>
  <div class="schema" v-if="schema.type === 'string' || schema.type === 'number'">
    <slot/>
    <p>
      <span>{{ schema.desc }}</span>
      <span v-if="schema._default">默认值：<code>{{ schema._default }}</code>。</span>
    </p>
    <div class="control">
      <k-input v-model="config" style="width: 28rem"/>
    </div>
  </div>

  <div class="schema" v-else-if="schema.type === 'boolean'">
    <slot/>
    <el-checkbox v-model="config">{{ schema.desc }}</el-checkbox>
  </div>

  <div class="schema" v-else-if="schema.type === 'array'">
    <slot/>
    <p>{{ schema.desc }}</p>
    <ul>
      <li v-for="(item, index) in config">{{ item }}</li>
    </ul>
  </div>

  <schema-group v-else-if="schema.type === 'object'" :desc="schema.desc">
    <k-schema v-for="(item, key) in schema.props" :schema="item" v-model="config[key]" :prefix="prefix + key + '.'">
      <h3>{{ prefix + key }}</h3>
    </k-schema>
  </schema-group>

  <template v-else-if="schema.type === 'merge'">
    <k-schema v-for="item in schema.values" :schema="item" v-model="config" :prefix="prefix"/>
  </template>
</template>

<script lang="ts" setup>

import { computed, watch } from 'vue'
import { Schema } from '@koishijs/utils'
import SchemaGroup from './group.vue'

const props = defineProps<{
  schema: Schema
  modelValue: any
  prefix?: string
}>()

const emit = defineEmits(['update:modelValue'])

function getFallback() {
  if (props.schema.type === 'object') {
    return {}
  } else if (props.schema.type === 'array') {
    return []
  }
}

const updateModelValue = emit.bind(null, 'update:modelValue')

const config = computed<any>({
  get: () => props.modelValue ?? getFallback(),
  set: updateModelValue,
})

watch(config, updateModelValue, { deep: true })

</script>

<style lang="scss">

.schema {
  margin: 2rem 0;

  h3 {
    font-size: 1.125em;
    margin: 0.5rem 0;
  }

  p {
    margin: 0;
    line-height: 1.7;
  }

  .control {
    margin: 0.625rem 0;
  }
}

</style>
