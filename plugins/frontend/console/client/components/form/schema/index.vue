<template>
  <template v-if="!schema || schema.meta.hidden"/>

  <schema-primitive v-else-if="['string', 'number', 'boolean'].includes(schema.type)" :schema="schema" v-model="config">
    <slot></slot>
  </schema-primitive>

  <div class="schema-item" v-else-if="schema.type === 'array'">
    <div class="schema-header">
      <div class="left">
        <slot></slot>
      </div>
      <div class="right">
        <k-button solid @click="config.push(null)">添加项</k-button>
      </div>
    </div>
    <ul>
      <li v-for="(_, index) in config" :key="index">
        <k-icon name="times-full" class="remove" @click="config.splice(index, 1)"></k-icon>
        <k-input v-model="config[index]" class="hidden"></k-input>
      </li>
    </ul>
  </div>

  <template v-else-if="schema.type === 'object'">
    <h2 v-if="!noDesc && schema.meta.description">{{ schema.meta.description }}</h2>
    <k-schema v-for="(item, key) in schema.dict" :key="key" :schema="item" v-model="config[key]" :prefix="prefix + key + '.'">
      <h3 :class="{ required: item.meta.required }">
        <span>{{ prefix + key }}</span>
      </h3>
      <p>{{ item.meta.description }}</p>
    </k-schema>
  </template>

  <template v-else-if="schema.type === 'const'"></template>

  <template v-else-if="schema.type === 'intersect'">
    <k-schema v-for="item in schema.list" :schema="item" v-model="config" :prefix="prefix"/>
  </template>

  <schema-union v-else-if="schema.type === 'union'" :schema="schema" :prefix="prefix" v-model="config">
    <slot></slot>
  </schema-union>

  <div class="schema-item" v-else>
    <slot></slot>
  </div>
</template>

<script lang="ts" setup>

import { watch, ref } from 'vue'
import type { PropType } from 'vue'
import Schema from 'schemastery'
import SchemaPrimitive from './primitive.vue'
import SchemaUnion from './union.vue'

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

const config = ref<any>()

watch(() => props.modelValue, (value) => {
  if (value !== null && value !== undefined) {
    config.value = value
  } else {
    config.value = getFallback()
    emit('update:modelValue', config.value)
  }
}, { immediate: true })

watch(config, (value) => {
  emit('update:modelValue', value)
}, { deep: true })

</script>

<style lang="scss">

.schema-item {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border);
  transition: border-color 0.3s ease;

  &:first-child, :not(.schema-item) + & {
    border-top: 1px solid var(--border);
  }

  &:last-child {
    margin-bottom: 2rem;
  }

  & + :not(.schema-item) {
    margin-top: 2rem;
  }

  &:hover {
    background: var(--bg2);
  }

  .schema-header {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    column-gap: 1rem;
  }

  h3 {
    margin: 0;
    font-size: 1.125em;
    line-height: 1.7;
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
    font-size: 0.875rem;
  }

  .left {
    display: inline-block;
  }

  .right {
    margin: 0.5rem 0;
    float: right;
  }

  .k-input .k-icon {
    height: 0.75rem;
    color: var(--fg3);
    transition: color 0.3s ease;

    &:hover {
      color: var(--fg1);
      cursor: pointer;
    }
  }

  ul {
    list-style: none;
    width: 100%;
    padding-left: 1rem;
    margin: 0;
    font-size: 0.875rem;

    li:first-child {
      margin-top: 0.25rem;
    }

    li:last-child {
      margin-bottom: 0.25rem;
    }

    .remove {
      color: var(--fg3);
      opacity: 0.4;
      transition: opacity 0.3s ease;
      height: 0.875rem;
      margin-right: 0.25rem;
      cursor: pointer;

      &:hover {
        opacity: 1;
      }
    }
  }
}

</style>
