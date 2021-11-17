<template>
  <div class="screw above" :class="placement"></div>
  <div class="screw below" :class="placement"></div>
</template>

<script lang="ts" setup>

defineProps<{
  placement: 'left' | 'right'
}>()

</script>

<style lang="scss" scoped>

$outer-size: 16px;
$inner-size: 6px;

.screw {
  position: absolute;
  top: 50%;
  width: $outer-size;
  height: $outer-size;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--card-bg);

  &.left {
    left: 0;
  }

  &.right {
    right: -1rem;
  }

  &.above {
    z-index: 10;
    transition: background-color 0.3s ease;
  }

  &.above::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: $inner-size;
    height: $inner-size;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--bg4);
    transition: background-color 0.3s ease;
  }

  &.below {
    z-index: -10;
    box-shadow: var(--card-shadow);
    transition: background-color 0.3s ease, box-shadow 0.3s ease;
  }
}

</style>
