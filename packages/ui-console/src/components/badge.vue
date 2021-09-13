<template>
  <span class="k-badge" :class="type">
    <slot/>
  </span>
</template>

<script lang="ts" setup>

defineProps<{ type?: 'warning' }>()

</script>

<style lang="scss">

@import '~/variables';

.k-badge {
  display: inline-block;
  font-size: 14px;
  height: 20px;
  line-height: 22px;
  border-radius: 4px;
  padding: 0 6px;
  margin-left: 8px;
  color: white;
  vertical-align: baseline;

  &.default {
    background-color: var(--active);
  }

  &.success {
    background-color: var(--success);
  }

  &.warning {
    background-color: var(--warning);
  }
}

</style>
