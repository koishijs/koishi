<template>
  <button
    :title="disabled ? '' : title"
    :class="['k-button', type, { disabled, solid, round, frameless }]"
  >
    <slot/>
  </button>
</template>

<script lang="ts" setup>

defineProps({
  type: {
    type: String,
    default: 'default',
  },
  solid: Boolean,
  frameless: Boolean,
  title: String,
  round: Boolean,
  disabled: Boolean,
})

</script>

<style lang="scss" scoped>

@import '../index.scss';

@mixin active-bg-color($color) {
  background-color: var(--#{$color}) !important;
  &:hover {
    background-color: var(--#{$color}-light) !important;
  }
  &:active {
    background-color: var(--#{$color}-dark) !important;
  }
}

button {
  font-size: 1em;
  line-height: 1.2em;
  appearance: none;
  user-select: none;
  border: none;
  border-radius: 0.4em;
  cursor: pointer;
  padding: 0.4em 1em;
  transition: 0.3s ease;
  display: inline-block;
  &.round {
    border-radius: 50%;
  }
  &:focus {
    outline: 0;
  }
  &.disabled {
    cursor: default;
  }
  // default: transparent & framed
  color: var(--active);
  border: 1px solid $tpBorderColor2;
  background-color: $tpBgColor1;
  &.disabled {
    color: $tpFgColor1;
    border-color: $tpBorderColor1;
    background-color: transparent;
  }
  &:hover:not(.disabled) {
    color: $tpFgColor4;
    border: 1px solid $tpBorderColor3;
    background-color: $tpBgColor2;
  }

  &.solid {
    color: #ffffff !important;
    border-color: transparent !important;
  }

  &.solid.disabled {
    background-color: var(--disabled) !important;
  }

  &.solid:not(.disabled) {
    &.default {
      @include active-bg-color('active');
    }
    &.warning {
      @include active-bg-color('warning');
    }
    &.error {
      @include active-bg-color('error');
    }
    &.success {
      @include active-bg-color('success');
    }
  }

  // frameless
  &.frameless {
    padding: 0;
    border-color: transparent;
    background-color: transparent;
    &:hover {
      border-color: transparent;
      background-color: transparent;
    }
    &.default {
      color: $default;
    }
    &.danger {
      color: $error;
    }
    &.success {
      color: $success;
    }
  }

  & + & {
    margin: 0 1rem;
  }
}

</style>
