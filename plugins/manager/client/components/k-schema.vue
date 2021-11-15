<template>
  <template v-if="!schema"/>

  <div class="schema" v-else-if="schema.type === 'string' || schema.type === 'number'">
    <slot></slot>
    <p>
      <span>{{ schema.desc }}</span>
      <span v-if="schema.meta.default">默认值：<code>{{ schema.meta.default }}</code>。</span>
    </p>
    <div class="control">
      <k-input v-model="config" style="width: 28rem"/>
    </div>
  </div>

  <div class="schema" v-else-if="schema.type === 'boolean'">
    <slot></slot>
    <div>
      <k-checkbox v-model="config">{{ schema.desc }}</k-checkbox>
    </div>
  </div>

  <div class="schema" v-else-if="schema.type === 'array'">
    <slot></slot>
    <p>{{ schema.desc }}</p>
    <ul>
      <li v-for="(item, index) in config">{{ item }}</li>
    </ul>
  </div>

  <schema-group v-else-if="schema.type === 'object'" :desc="!noDesc && schema.desc">
    <k-schema v-for="(item, key) in schema.dict" :schema="item" v-model="config[key]" :prefix="prefix + key + '.'">
      <h3 :class="{ required: item.meta.required }">
        <span>{{ prefix + key }}</span>
      </h3>
    </k-schema>
  </schema-group>

  <template v-else-if="schema.type === 'intersect'">
    <k-schema v-for="item in schema.list" :schema="item" v-model="config" :prefix="prefix"/>
  </template>

  <div class="schema" v-else-if="schema.type === 'select'">
    <slot></slot>
    <p>{{ schema.desc }}</p>
    <ul>
      <li v-for="(label, key) in schema.sDict">
        <k-radio :label="key" v-model="config">{{ label }}</k-radio>
      </li>
    </ul>
  </div>

  <template v-else-if="schema.type === 'decide'">
    <div class="schema">
      <h3 class="required">
        <span>{{ prefix + schema.key }}</span>
      </h3>
      <p>{{ schema.desc }}</p>
      <ul>
        <li v-for="(item, key) in schema.dict">
          <k-radio :label="key" v-model="config[schema.key]">{{ item.desc }}</k-radio>
        </li>
      </ul>
    </div>
    <k-schema :schema="schema.dict[config[schema.key]]" v-model="config" :prefix="prefix" no-desc/>
  </template>
</template>

<script lang="ts" setup>

import { computed, watch } from 'vue'
import type { PropType } from 'vue'
import Schema from 'schemastery'
import SchemaGroup from './k-schema-group.vue'

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
  prefix: { type: String, default: '' },
  noDesc: { type: Boolean, required: false },
})

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

  ul {
    list-style: none;
    width: 100%;
    padding-left: 0;
    margin: 0.25rem 0;
  }
}

</style>
