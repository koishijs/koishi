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
  height: 20px;
  line-height: 22px;
  border-radius: 4px;
  padding: 0 6px;
  margin-left: 8px;
  color: white;
  vertical-align: baseline;

  @include apply-color(primary);
  @include apply-color(default);
  @include apply-color(warning);
  @include apply-color(success);
  @include apply-color(error);
}

</style>
