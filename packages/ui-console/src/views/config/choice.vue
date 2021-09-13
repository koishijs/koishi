<template>
  <div class="choice" :class="{ active: data.name === modelValue.name }" @click="$emit('update:modelValue', data)">
    {{ data.name || '全局配置' }}
  </div>
</template>

<script lang="ts" setup>

import { Registry } from '~/server'

defineEmits(['update:modelValue'])

defineProps<{
  modelValue: Registry.Data
  data: Registry.Data
}>()

</script>
