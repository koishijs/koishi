<template>
  <span class="k-badge" :class="type">
    <slot/>
  </span>
</template>

<script lang="ts" setup>

defineProps<{ type?: 'warning' }>()

</script>

<style lang="scss">

@mixin apply-color($name) {
  &.#{$name} {
    background-color: var(--#{$name});
  }
}

.k-badge {
  display: inline-block;
  font-size: 14px;
  height: 24px;
  line-height: 24px;
  border-radius: 4px;
  padding: 0 6px;
  margin-right: 0.5rem;
  color: white;
  font-weight: 500;
  vertical-align: baseline;

  @include apply-color(primary);
  @include apply-color(warning);
  @include apply-color(success);
  @include apply-color(error);
}

</style>
