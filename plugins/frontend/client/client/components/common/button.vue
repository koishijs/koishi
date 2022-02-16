<template>
  <button
    @click.prevent="onClick"
    :title="disabled ? '' : title"
    :class="['k-button', type, { disabled, solid, round, frameless }]">
    <slot/>
  </button>
</template>

<script lang="ts" setup>

const props = defineProps({
  type: {
    type: String,
    default: 'primary',
  },
  solid: Boolean,
  frameless: Boolean,
  title: String,
  round: Boolean,
  disabled: Boolean,
})

const emit = defineEmits(['click'])

function onClick(event: MouseEvent) {
  if (props.disabled) return
  emit('click', event)
}

</script>

<style lang="scss">

@mixin apply-color($name) {
  &.#{$name} {
    background-color: var(--#{$name}) !important;
    &:hover {
      background-color: var(--#{$name}-tint) !important;
    }
    &:active {
      background-color: var(--#{$name}-shade) !important;
    }
  }
}

.k-button {
  font-size: 14px;
  font-weight: bolder;
  line-height: 20px;
  appearance: none;
  user-select: none;
  border: none;
  border-radius: 0.4em;
  cursor: pointer;
  padding: 0.4em 1em;
  transition: color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease;
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
  color: var(--fg2);
  border: 1px solid var(--border);
  background-color: transparent;
  &.disabled {
    color: var(--disabled);
    border-color: var(--border);
  }
  &:hover:not(.disabled) {
    color: var(--fg1);
    border: 1px solid var(--border-dark);
    background-color: var(--bg1);
  }

  &.solid {
    color: #ffffff !important;
    border-color: transparent !important;
    &.disabled {
      background-color: var(--disabled) !important;
    }
    &:not(.disabled) {
      @include apply-color(primary);
      @include apply-color(warning);
      @include apply-color(success);
      @include apply-color(error);
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
    &.primary {
      color: var(--el-color-primary);
    }
    &.error {
      color: var(--el-color-error);
    }
    &.success {
      color: var(--el-color-success);
    }
    &.disabled {
      color: var(--disabled);
    }
  }

  .k-button-group > &:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .k-button-group > &:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    &:not(:hover) {
      border-right-width: 0;
    }
  }
  .k-button-group > &:hover + & {
    border-left-width: 0;
  }

  *:not(.k-button-group) > & + & {
    margin: 0 1rem;
  }
}

</style>
