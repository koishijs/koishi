<template>
  <template v-if="!schema || schema.meta.hidden"/>

  <template v-else-if="schema.type === 'object'">
    <h2 v-if="!noDesc && schema.meta.description">{{ schema.meta.description }}</h2>
    <k-schema v-for="(item, key) in schema.dict" :key="key"
      v-model="config[key]"
      :schema="item"
      :initial="initial?.[key]"
      :disabled="disabled"
      :prefix="prefix + key + '.'">
      <h3 :class="{ required: item.meta.required }">
        <span>{{ prefix + key }}</span>
      </h3>
      <k-markdown tag="p" inline :source="item.meta.description"></k-markdown>
    </k-schema>
  </template>

  <template v-else-if="schema.type === 'intersect'">
    <k-schema v-for="(item, index) in schema.list" :key="index"
      v-model="config"
      :initial="initial"
      :schema="item"
      :disabled="disabled"
      :prefix="prefix"
    ></k-schema>
  </template>

  <template v-else-if="schema.type === 'union'">
    <k-schema v-if="choices.length === 1"
      v-model="config"
      :schema="choices[0]"
      :prefix="prefix"
      :initial="initial"
      :disabled="disabled">
      <slot></slot>
    </k-schema>

    <schema-item v-else :changed="hasChange">
      <template #left>
        <slot></slot>
      </template>

      <template #right v-if="isSelect">
        <el-select v-model="config" :disabled="disabled">
          <el-option
            v-for="item in choices"
            :key="item.value"
            :label="item.value"
            :value="item.value"
          ></el-option>
        </el-select>
      </template>

      <ul v-if="isRadio">
        <li v-for="item in choices" :key="item.value">
          <el-radio
            v-model="config"
            :disabled="disabled"
            :label="item.value"
          >{{ item.meta.description }}</el-radio>
        </li>
      </ul>
    </schema-item>
  </template>

  <schema-item :changed="hasChange" v-else>
    <template #left>
      <slot></slot>
    </template>

    <template #right>
      <template v-if="isPrimitive(schema)">
        <schema-primitive
          v-model="config"
          :initial="initial"
          :schema="schema"
          :disabled="disabled"
        ></schema-primitive>
      </template>

      <template v-else-if="(schema.type === 'array' || schema.type === 'dict') && isPrimitive(schema.inner)">
        <k-button solid @click="config.push(null)" :disabled="disabled">添加项</k-button>
      </template>
    </template>

    <template v-if="schema.type === 'array' && isPrimitive(schema.inner)">
      <ul>
        <li v-for="(_, index) in config" :key="index">
          <k-icon name="times-full" class="remove" @click="config.splice(index, 1)"></k-icon>
          <el-input v-model="config[index]"></el-input>
        </li>
      </ul>
    </template>

    <template v-else-if="schema.type === 'dict' && isPrimitive(schema.inner)">
      <ul>
        <li v-for="(_, key) in config">
          <k-icon name="times-full" class="remove" @click="delete config[key]"></k-icon>
          <el-input :model-value="key" @update:model-value="v => (config[v] = config[key], delete config[key])"></el-input>
          <el-input v-model="config[key]"></el-input>
        </li>
      </ul>
    </template>
  </schema-item>
</template>

<script lang="ts" setup>

import { watch, ref, computed } from 'vue'
import type { PropType } from 'vue'
import Schema, { clone } from 'schemastery'
import SchemaItem from './item.vue'
import SchemaPrimitive from './primitive.vue'

const props = defineProps({
  schema: {} as PropType<Schema>,
  initial: {},
  modelValue: {},
  disabled: Boolean,
  noDesc: Boolean,
  prefix: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

function deepEqual(a: any, b: any) {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (!a || !b) return false

  // check array
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index]))
  } else if (Array.isArray(b)) {
    return false
  }

  // check object
  return Object.keys({ ...a, ...b }).every(key => deepEqual(a[key], b[key]))
}

const hasChange = computed(() => {
  return !deepEqual(props.initial, props.modelValue)
})

const choices = computed(() => {
  return props.schema.list.filter(item => !['function', 'transform'].includes(item.type))
})

const isSelect = computed(() => {
  return choices.value.every(item => item.type === 'const')
    && choices.value.some(item => !item.meta.description)
})

const isRadio = computed(() => {
  return choices.value.every(item => item.type === 'const')
    && choices.value.every(item => item.meta.description)
})

const config = ref()

function getFallback() {
  if (!props.schema || props.schema.type === 'union' && choices.value.length === 1) return
  return clone(props.schema.meta.default)
}

watch(() => props.modelValue, (value) => {
  config.value = value ?? getFallback()
}, { immediate: true })

watch(config, (value) => {
  if (props.schema && props.initial === undefined && deepEqual(value, props.schema.meta.default)) {
    emit('update:modelValue', undefined)
  } else {
    emit('update:modelValue', value)
  }
}, { deep: true })

function isPrimitive(schema: Schema) {
  return ['string', 'number', 'boolean'].includes(schema.type)
}

</script>

<style lang="scss">

.schema-item {
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
    transition: 0.3s ease;
  }

  p {
    margin: 0;
    line-height: 1.7;
    font-size: 0.875rem;
  }

  li .el-input {
    display: inline;
    > input {
      border: none;
      max-width: 200px;
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
      transition: 0.3s ease;
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
