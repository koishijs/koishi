<template>
  <el-checkbox v-model="model" :disabled="disabled">{{ label }}</el-checkbox>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const emit = defineEmits(['update:modelValue'])

const props = defineProps<{
  label: string
  value: number
  modelValue: number
  disabled?: boolean
}>()

const model = computed({
  get: () => !!(props.modelValue & props.value),
  set: () => {
    emit('update:modelValue', props.modelValue ^ props.value)
  },
})

</script>
