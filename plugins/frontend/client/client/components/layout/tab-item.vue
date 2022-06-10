<template>
  <div class="k-tab-item k-menu-item"
    :class="{ active: label === modelValue }"
    @click="$emit('update:modelValue', label)">
    <slot>{{ label }}</slot>
  </div>
</template>

<script lang="ts" setup>

defineEmits(['update:modelValue'])

defineProps<{
  label: string
  modelValue: string
}>()

</script>

<style lang="scss" scoped>

.k-tab-item {
  line-height: 2.25rem;
  padding: 0 2rem 0 4rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.active {
    background-color: var(--hover-bg);
  }
}

</style>
