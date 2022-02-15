<template>
  <k-schema v-if="choices.length === 1" :schema="choices[0]" :prefix="prefix" v-model="config" :disabled="disabled">
    <slot></slot>
  </k-schema>

  <div class="schema-item" v-else-if="isSelect">
    <div class="schema-header">
      <div class="left">
        <slot></slot>
      </div>
      <div class="right">
        <el-select v-model="config" :disabled="disabled">
          <el-option
            v-for="item in choices"
            :key="item.value"
            :label="item.value"
            :value="item.value"
          ></el-option>
        </el-select>
      </div>
    </div>
  </div>

  <div class="schema-item" v-else>
    <slot></slot>
    <ul v-if="choices.every(item => item.type === 'const')">
      <li v-for="item in choices" :key="item.value">
        <el-radio :disabled="disabled" :label="item.value" v-model="selected">{{ item.meta.description || item.value }}</el-radio>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>

import { computed, ref } from 'vue'
import type { PropType } from 'vue'
import Schema from 'schemastery'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
  prefix: String,
  disabled: Boolean,
})

const config = computed({
  get: () => props.modelValue ?? props.schema.meta.default,
  set: emit.bind(null, 'update:modelValue'),
})

const choices = computed(() => {
  return props.schema.list.filter(item => !['function', 'transform'].includes(item.type))
})

const isSelect = computed(() => {
  return choices.value.every(item => item.type === 'const')
    && choices.value.some(item => !item.meta.description)
})

const selected = ref(props.schema.meta.default)

</script>
