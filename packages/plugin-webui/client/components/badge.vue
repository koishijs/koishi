<template>
  <span class="k-badge" :class="type">
    <slot/>
  </span>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'

defineProps<{ type?: 'warn' }>()

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
    background-color: $default;
  }

  &.warn {
    background-color: $warning;
  }
}

</style>
