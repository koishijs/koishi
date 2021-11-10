<template>
  <div class="k-tab-item" :class="{ active: label === modelValue, readonly }" @click="$emit('update:modelValue', label)">
    <slot>{{ label }}</slot>
  </div>
</template>

<script lang="ts" setup>

defineEmits(['update:modelValue'])

defineProps<{
  label: string
  readonly?: boolean
  modelValue: string
}>()

</script>

<style lang="scss" scoped>

@import '~/variables';

.k-tab-item {
  @include button-like;

  line-height: 2.25rem;
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
