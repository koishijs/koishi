<template>
  <template v-if="!schema || schema.meta.hidden"/>

  <template v-else-if="schema.type === 'object'">
    <h2 v-if="schema.meta.description">{{ schema.meta.description }}</h2>
    <k-schema v-for="(item, key) in schema.dict" :key="key"
      v-model="config[key]"
      :schema="item"
      :initial="initial?.[key]"
      :disabled="disabled"
      :prefix="prefix + key + '.'">
      <h3>
        <span>{{ prefix + key }}</span>
      </h3>
      <k-markdown inline :source="item.meta.description"></k-markdown>
    </k-schema>
  </template>

  <template v-else-if="schema.type === 'intersect' || schema.type === 'union' && choices.length === 1">
    <k-schema v-for="(item, index) in choices" :key="index"
      v-model="config"
      :initial="initial"
      :schema="item"
      :disabled="disabled"
      :prefix="prefix">
      <slot></slot>
    </k-schema>
  </template>

  <schema-item v-else :disabled="disabled" :class="{ changed, required, invalid }" @command="handleCommand">
    <template #menu>
      <el-dropdown-item command="discard">撤销更改</el-dropdown-item>
      <el-dropdown-item command="default">恢复默认值</el-dropdown-item>
      <slot name="menu"></slot>
    </template>

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

      <template v-else-if="isComposite">
        <k-button solid @click="signal = true" :disabled="disabled">添加项</k-button>
      </template>

      <template v-else-if="isSelect">
        <el-select v-model="config" :disabled="disabled">
          <el-option
            v-for="item in choices"
            :key="item.value"
            :label="item.value"
            :value="item.value"
          ></el-option>
        </el-select>
      </template>
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

  <schema-group ref="group" v-if="!schema.meta.hidden && isComposite" v-model:signal="signal"
    :schema="schema" v-model="config" :prefix="prefix" :disabled="disabled" :initial="initial">
  </schema-group>
</template>

<script lang="ts" setup>

import { watch, ref, computed } from 'vue'
import type { PropType } from 'vue'
import { clone, deepEqual, getChoices, getFallback, Schema, validate } from './utils'
import SchemaItem from './item.vue'
import SchemaGroup from './group.vue'
import SchemaPrimitive from './primitive.vue'

const props = defineProps({
  schema: {} as PropType<Schema>,
  initial: {},
  modelValue: {},
  instant: Boolean,
  invalid: Boolean,
  disabled: Boolean,
  prefix: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'command'])

const changed = computed(() => {
  return !props.instant && !deepEqual(props.initial, props.modelValue)
})

const required = computed(() => {
  return props.schema.meta.required && props.modelValue === undefined
})

const choices = computed(() => getChoices(props.schema))

const isSelect = computed(() => {
  return props.schema.type === 'union'
    && choices.value.every(item => item.type === 'const')
    && choices.value.some(item => !item.meta.description)
})

const isRadio = computed(() => {
  return props.schema.type === 'union'
    && choices.value.every(item => item.type === 'const')
    && choices.value.every(item => item.meta.description)
})

const isComposite = computed(() => {
  return ['array', 'dict'].includes(props.schema.type) && validate(props.schema.inner)
})

const config = ref()
const signal = ref(false)

watch(() => props.modelValue, (value) => {
  config.value = value ?? getFallback(props.schema)
}, { immediate: true })

watch(config, (value) => {
  if (!props.schema) return
  if (props.initial === undefined && deepEqual(value, props.schema.meta.default)) {
    emit('update:modelValue', undefined)
  } else {
    emit('update:modelValue', value)
  }
}, { deep: true })

function isPrimitive(schema: Schema) {
  return ['string', 'number', 'boolean'].includes(schema.type)
}

function handleCommand(action: string) {
  if (action === 'discard') {
    emit('update:modelValue', clone(props.initial))
  } else if (action === 'default') {
    emit('update:modelValue', undefined)
  } else {
    emit('command', action)
  }
}

</script>

<style lang="scss">

.k-schema-group {
  position: relative;
  padding-left: 1rem;
  border-bottom: 1px solid var(--border);

  &:empty {
    border-bottom: none;
  }

  > :first-child {
    border-top: none;
  }

  > :last-child {
    border-bottom: none;
  }
}

.schema-item {
  h3 {
    margin: 0;
    font-size: 1.125em;
    line-height: 1.7;
    position: relative;
    user-select: none;
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
