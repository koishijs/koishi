<template>
  <template v-if="!schema || schema.meta.hidden"/>

  <template v-else-if="schema.type === 'object'">
    <h2 v-if="schema.meta.description">{{ schema.meta.description }}</h2>
    <k-schema v-for="(item, key) in schema.dict" :key="key"
      v-model="config[key]"
      :schema="item"
      :initial="initial?.[key]"
      :instant="instant"
      :disabled="disabled"
      :prefix="prefix + key + '.'">
      <h3>
        <span class="prefix">{{ prefix }}</span>
        <span>{{ key }}</span>
      </h3>
      <k-markdown inline :source="item.meta.description"></k-markdown>
    </k-schema>
  </template>

  <template v-else-if="schema.type === 'intersect' || schema.type === 'union' && choices.length === 1">
    <k-schema v-for="(item, index) in choices" :key="index"
      v-model="config"
      :initial="initial"
      :schema="{ ...item, meta: { default: schema.meta.default, ...item.meta } }"
      :instant="instant"
      :disabled="disabled"
      :prefix="prefix">
      <slot></slot>
    </k-schema>
  </template>

  <template v-else-if="schema.type === 'const'"></template>

  <schema-item v-else-if="prefix || (!isComposite && schema?.type !== 'union')" :disabled="disabled" :class="{ changed, required, invalid }" @command="handleCommand">
    <template #menu>
      <el-dropdown-item command="discard">撤销更改</el-dropdown-item>
      <el-dropdown-item command="default">恢复默认值</el-dropdown-item>
      <slot name="menu"></slot>
    </template>

    <template #left>
      <slot></slot>
    </template>

    <template #right>
      <template v-if="schema.type === 'union' && !isRadio">
        <el-select v-model="selectModel" :disabled="disabled">
          <el-option
            v-for="(item, index) in choices"
            :key="index"
            :value="index"
            :label="item.meta.description || item.value"
          ></el-option>
        </el-select>
      </template>

      <template v-if="isPrimitive(active) && (schema.type !== 'union' || active.type !== 'const')">
        <schema-primitive
          v-model="config"
          :initial="initial"
          :schema="active"
          :disabled="disabled"
        ></schema-primitive>
      </template>

      <template v-else-if="isComposite">
        <k-button solid @click="signal = true" :disabled="disabled">添加项</k-button>
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

    <ul v-else-if="schema.type === 'bitset'">
      <li v-for="(value, key) in schema.bits" :key="value">
        <bit-checkbox
          v-model="config"
          :disabled="disabled"
          :label="key"
          :value="value"
        ></bit-checkbox>
      </li>
    </ul>
  </schema-item>

  <template v-if="schema && !schema.meta.hidden && isComposite">
    <div class="k-schema-group" v-if="prefix">
      <schema-group v-model:signal="signal"
        :schema="active" v-model="config" :prefix="prefix" :disabled="disabled" :instant="instant" :initial="initial">
      </schema-group>
    </div>

    <!-- top level array / dict -->
    <template v-else>
      <h2>
        {{ schema.meta.description || '配置列表' }}
        <k-button solid @click="signal = true" :disabled="disabled">添加项</k-button>
      </h2>
      <schema-group v-model:signal="signal"
        :schema="active" v-model="config" :prefix="prefix" :disabled="disabled" :instant="instant" :initial="initial">
      </schema-group>
    </template>
  </template>

  <!-- union containing object -->
  <template v-else-if="schema?.type === 'union' && choices.length > 1 && ['object', 'intersect'].includes(active?.type)">
    <k-schema 
      v-model="config"
      :initial="initial"
      :schema="{ ...active, meta: { ...active.meta } }"
      :instant="instant"
      :disabled="disabled"
      :prefix="prefix"
    ></k-schema>
  </template>
</template>

<script lang="ts" setup>

import { watch, ref, computed } from 'vue'
import type { PropType } from 'vue'
import { deepEqual, getChoices, getFallback, Schema, validate } from './utils'
import { clone, isNullable } from 'cosmokit'
import BitCheckbox from './bit.vue'
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
  return props.schema.meta.required
    && isNullable(props.schema.meta.default)
    && isNullable(props.modelValue)
})

const choices = ref<Schema[]>()
const cache = ref<any[]>()
const active = ref<Schema>()

watch(() => props.schema, (value) => {
  if (!value?.list) {
    choices.value = []
    return
  }
  choices.value = getChoices(props.schema)
  cache.value = choices.value.map((item) => {
    if (item.type === 'const') return item.value
    return getFallback(item, true)
  })
}, { immediate: true })

const selectModel = computed({
  get() {
    if (active.value === props.schema) return
    return active.value.meta.description || active.value.value
  },
  set(index) {
    if (active.value === choices.value[index]) return
    config.value = cache.value[index]
    active.value = choices.value[index]
  },
})

const isRadio = computed(() => {
  return props.schema.type === 'union'
    && choices.value.every(item => item.type === 'const')
    && choices.value.every(item => item.meta.description)
})

const isComposite = computed(() => {
  return ['array', 'dict'].includes(active.value.type) && validate(active.value.inner)
})

const config = ref()
const signal = ref(false)

watch(() => props.modelValue, (value) => {
  active.value = props.schema
  for (const item of choices.value) {
    try {
      item(value)
      active.value = item
      break
    } catch {}
  }
  config.value = value ?? getFallback(props.schema)
}, { immediate: true, deep: true })

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

    .prefix {
      font-weight: normal;
    }
  }

  p {
    margin: 0;
    line-height: 1.7;
    font-size: 0.875rem;
  }

  ul {
    list-style: none;
    width: 100%;
    padding-left: 1rem;
    margin: 0;
    font-size: 0.875rem;
    margin: 0.5rem 0 0.25rem;

    .el-radio, .el-checkbox {
      height: 1.375rem;
    }
  }

  .el-select:not(:last-child) {
    width: 10rem;
    margin-right: 1rem;
  }
}

</style>
