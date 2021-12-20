<template>
  <template v-if="!schema"/>

  <div class="schema" v-else-if="schema.type === 'string' || schema.type === 'number'">
    <slot></slot>
    <p>
      <span>{{ schema.meta.description }}</span>
      <span v-if="schema.meta.default">默认值：<code>{{ schema.meta.default }}</code>。</span>
    </p>
    <div class="control">
      <k-input v-model="config" style="width: 28rem"/>
    </div>
  </div>

  <div class="schema" v-else-if="schema.type === 'boolean'">
    <slot></slot>
    <div>
      <k-checkbox v-model="config">{{ schema.meta.description }}</k-checkbox>
    </div>
  </div>

  <div class="schema" v-else-if="schema.type === 'array'">
    <slot></slot>
    <p>{{ schema.meta.description }}</p>
    <ul>
      <li v-for="(item, index) in config" :key="index">{{ item }}</li>
    </ul>
  </div>

  <schema-group v-else-if="schema.type === 'object'" :desc="!noDesc && schema.meta.description">
    <k-schema v-for="(item, key) in schema.dict" :schema="item" v-model="config[key]" :prefix="prefix + key + '.'">
      <h3 :class="{ required: item.meta.required }">
        <span>{{ prefix + key }}</span>
      </h3>
    </k-schema>
  </schema-group>

  <template v-else-if="schema.type === 'const'"></template>

  <template v-else-if="schema.type === 'intersect'">
    <k-schema v-for="item in schema.list" :schema="item" v-model="config" :prefix="prefix"/>
  </template>

  <template v-else-if="schema.type === 'union'">
    <div class="schema">
      <slot>
        <h3 class="required">protocol</h3>
      </slot>
      <p>{{ schema.meta.description }}</p>
      <ul>
        <li v-for="(inner, key) in schema.list" :key="key">
          <k-radio :label="key" v-model="selected">{{ inner.meta.description }}</k-radio>
        </li>
      </ul>
    </div>

    <k-schema v-if="selected !== null" :schema="schema.list[selected]" v-model="config" :prefix="prefix"/>
  </template>
</template>

<script lang="ts" setup>

import { computed, watch, ref } from 'vue'
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
  const { type } = props.schema
  if (type === 'object' || type === 'dict') {
    return {}
  } else if (type === 'array' || type === 'tuple') {
    return []
  }
}

const updateModelValue = emit.bind(null, 'update:modelValue')

const config = computed<any>({
  get: () => props.modelValue ?? getFallback(),
  set: updateModelValue,
})

watch(config, updateModelValue, { deep: true })

watch(() => props.schema, (schema) => {
  if (schema.type === 'const') {
    updateModelValue(schema.value)
  }
}, { deep: true, immediate: true })

const selected = ref<number>(null)

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
