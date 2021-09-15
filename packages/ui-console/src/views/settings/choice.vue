<template>
  <div class="choice" :class="attribs" @click="$emit('update:modelValue', data)">
    {{ data.name || '全局设置' }}
  </div>
</template>

<script lang="ts" setup>

import { Registry } from '~/server'
import { computed } from 'vue'

defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: Registry.Data
  data: Registry.Data
}>()

const attribs = computed(() => ({
  active: props.data.name === props.modelValue.name,
  readonly: !props.data.schema,
}))

</script>
