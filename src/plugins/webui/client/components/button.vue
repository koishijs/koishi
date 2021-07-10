<template>
  <button
    :title="disabled ? '' : title"
    :class="['k-button', type, { solid, round, frameless }]"
    :disabled="disabled"
  >
    <slot/>
  </button>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'

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
  background-color: $color !important;
  &:hover {
    background-color: lighten($color, 30%) !important;
  }
  &:active {
    background-color: darken($color, 30%) !important;
  }
  &:disabled {
    background-color: #999 !important;
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
  padding: 0.6em 1em;
  transition: 0.3s ease;
  display: inline-block;
  &.round {
    border-radius: 50%;
  }
  &:focus {
    outline: 0;
  }
  &:disabled {
    cursor: default;
  }
  // default: transparent & framed
  color: $tpFgColor3;
  border: 1px solid $tpBorderColor2;
  background-color: $tpBgColor1;
  &:disabled {
    color: $tpFgColor1;
    border-color: $tpBorderColor1;
    background-color: transparent;
  }
  &:hover:not(:disabled) {
    color: $tpFgColor4;
    border: 1px solid $tpBorderColor3;
    background-color: $tpBgColor2;
  }
  // dim
  &.dim {
    border-color: $tpBorderColor1;
    background-color: transparent;
    &:hover:not(:disabled) {
      border-color: $tpBorderColor2;
      background-color: $tpBgColor1;
    }
  }
  // solid
  &.solid {
    color: #ffffff !important;
    border-color: transparent !important;
    &.default {
      @include active-bg-color($accentColor);
    }
    &.danger {
      @include active-bg-color($warningColor);
    }
    &.success {
      @include active-bg-color($successColor);
    }
  }
  // frameless
  &.frameless {
    padding: 0;
    border-color: transparent;
    background-color: transparent;
    text-shadow: 1px 2px 3px #000a;
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
}

</style>
