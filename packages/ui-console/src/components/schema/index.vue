<template>
  <template v-if="!schema"/>

  <div class="schema" v-else-if="schema.type === 'string' || schema.type === 'number'">
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
    <p>
      <k-checkbox v-model="config">{{ schema.desc }}</k-checkbox>
    </p>
  </div>

  <div class="schema" v-else-if="schema.type === 'array'">
    <slot/>
    <p>{{ schema.desc }}</p>
    <ul>
      <li v-for="(item, index) in config">{{ item }}</li>
    </ul>
  </div>

  <schema-group v-else-if="schema.type === 'object'" :desc="!noDesc && schema.desc">
    <k-schema v-for="(item, key) in schema.dict" :schema="item" v-model="config[key]" :prefix="prefix + key + '.'">
      <h3 :class="{ required: item._required }">
        <span>{{ prefix + key }}</span>
      </h3>
    </k-schema>
  </schema-group>

  <template v-else-if="schema.type === 'merge'">
    <k-schema v-for="item in schema.list" :schema="item" v-model="config" :prefix="prefix"/>
  </template>

  <template v-else-if="schema.type === 'select'">
    <div class="schema">
      <h3 class="required">
        <span>{{ prefix + schema.primary }}</span>
      </h3>
      <p>{{ schema.desc }}</p>
      <el-radio-group v-model="config[schema.primary]">
        <el-radio v-for="(item, key) in schema.dict" :label="key">{{ item.desc }}</el-radio>
      </el-radio-group>
    </div>
    <k-schema :schema="schema.dict[config[schema.primary]]" v-model="config" :prefix="prefix" no-desc/>
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
  noDesc?: boolean
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
    margin: 0.25rem 0;
    position: relative;
  }

  h3.required::before {
    content: '*';
    position: absolute;
    left: -1.25rem;
    color: var(--error);
  }

  p {
    margin: 0;
    line-height: 1.7;
  }

  .control {
    margin: 0.5rem 0;
  }
}

</style>
