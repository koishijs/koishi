<template>
  <div class="schema-item">
    <div class="schema-header">
      <div class="left">
        <slot></slot>
      </div>
      <div class="right">
        <k-switch v-if="schema.type === 'boolean'" v-model="config" :initial="schema.meta.default" :disabled="disabled"></k-switch>
        <k-input v-else v-model="config" :disabled="disabled"
          :style="{ width: schema.meta.role === 'url' ? '18rem' : '12rem' }"
          :type="type" :initial="schema.meta.default">
          <template #suffix v-if="schema.meta.role === 'url'">
            <a :href="config" target="_blank" rel="noopener noreferrer">
              <k-icon name="external"></k-icon>
            </a>
          </template>
          <template #suffix v-else-if="schema.meta.role === 'secret'">
            <k-icon :name="showPass ? 'eye' : 'eye-slash'" @click="showPass = !showPass"></k-icon>
          </template>
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

const config = computed({
  get: () => props.modelValue,
  set: emit.bind(null, 'update:modelValue'),
})

const type = computed(() => {
  const { type, meta } = props.schema
  return type === 'number' ? 'number' : meta.role === 'secret' && !showPass.value ? 'password' : 'text'
})

</script>
