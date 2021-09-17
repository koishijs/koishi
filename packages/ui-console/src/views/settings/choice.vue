<template>
  <div class="t-choice" :class="attribs" @click="$emit('update:modelValue', props.data.name)">
    {{ props.data.name || '全局设置' }}
  </div>
</template>

<script lang="ts" setup>

import type { Registry } from '~/server'
import { computed } from 'vue'

defineEmits(['update:modelValue'])

const props = defineProps<{
  modelValue: string
  data: Registry.Data
}>()

const attribs = computed(() => ({
  active: props.data.name === props.modelValue,
  readonly: !props.data.schema,
}))

</script>

<style lang="scss" scoped>

@import '~/variables';

.t-choice {
  @include button-like;

  padding: 0 2rem 0 4rem;

  &.active {
    background-color: var(--bg1);
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
