<template>
  <div class="schema-item">
    <div class="schema-header">
      <div class="left">
        <slot></slot>
      </div>
      <div class="right">
        <el-switch v-if="schema.type === 'boolean'" v-model="value" :disabled="disabled"></el-switch>
        <template v-else-if="schema.type === 'number'">
          <el-slider v-if="schema.meta.role === 'slider'" style="width: 200px"
            v-model="value" :disabled="disabled" :max="schema.meta.max" :min="schema.meta.min" :step="schema.meta.step"
          ></el-slider>
          <el-input-number v-else
            v-model="value" :disabled="disabled" :max="schema.meta.max" :min="schema.meta.min" :step="schema.meta.step"
          ></el-input-number>
        </template>
        <k-input v-else v-model="value" :disabled="disabled" #suffix
          :style="{ width: schema.meta.role === 'url' ? '18rem' : '12rem' }" :type="type">
          <a v-if="schema.meta.role === 'url'" :href="value" target="_blank" rel="noopener noreferrer">
            <k-icon name="external"></k-icon>
          </a>
          <k-icon v-else-if="schema.meta.role === 'secret'" :name="showPass ? 'eye' : 'eye-slash'" @click="showPass = !showPass"></k-icon>
        </k-input>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { computed, PropType, ref } from 'vue'
import Schema from 'schemastery'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
  disabled: Boolean,
})

const showPass = ref(false)

const value = computed({
  get: () => props.modelValue ?? props.schema.meta.default,
  set: emit.bind(null, 'update:modelValue'),
})

const type = computed(() => {
  const { type, meta } = props.schema
  return type === 'number' ? 'number' : meta.role === 'secret' && !showPass.value ? 'password' : 'text'
})

</script>
