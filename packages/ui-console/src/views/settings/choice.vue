<template>
  <div class="t-choice" :class="attribs" @click="$emit('update:modelValue', data)">
    {{ data.name || '全局设置' }}
  </div>
</template>

<script lang="ts" setup>

import type { Registry } from '~/server'
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

<style lang="scss" scoped>

.t-choice {
  cursor: pointer;
  padding: 0 2rem 0 4rem;
  transition: 0.3s ease;

  &:hover, &.active {
    background-color: var(--bg1);
  }

  &.active {
    font-weight: bold;
    color: var(--primary);
  }

  &.readonly {
    color: var(--fg3t);

    &:hover, &.active {
      color: var(--fg1);
    }
  }
}

</style>
