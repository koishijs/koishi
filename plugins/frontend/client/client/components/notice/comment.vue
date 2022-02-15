<template>
  <div class="k-comment" :class="type">
    <k-icon :name="icon"></k-icon>
    <h4 class="k-comment-header">
      <slot>{{ title }}</slot>
    </h4>
    <slot name="body"></slot>
  </div>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const props = defineProps({
  type: { type: String, default: 'primary' },
  title: { type: String, required: false },
})

const icon = computed(() => {
  switch (props.type) {
    case 'success': return 'check-full'
    case 'error': return 'times-full'
    case 'warning': return 'exclamation-full'
    default: return 'info-full'
  }
})

</script>

<style lang="scss" scoped>

@mixin apply-color($name) {
  &.#{$name} {
    border-left-color: var(--#{$name});
    background-color: var(--#{$name}-fade);
    .k-icon {
      color: var(--#{$name});
    }
  }
}

.k-comment {
  padding: 1px 1.5rem !important;
  margin: 2rem 0;
  border-left-width: 4px !important;
  border-left-style: solid;
  position: relative;
  line-height: 1.7;
  transition: 0.3s ease;

  h4 {
    margin: 1rem 0;
  }

  > .k-icon {
    position: absolute;
    top: 20px;
    left: -12px;
    width: 20px;
    height: 19px;
    border-radius: 100%;
    font-weight: 700;
    font-size: 20px;
    background-color: var(--card-bg);
  }

  @include apply-color(primary);
  @include apply-color(warning);
  @include apply-color(success);
  @include apply-color(error);

  & + & {
    margin-top: -1rem;
  }
}

</style>
