<template>
  <label class="k-radio" :class="{ disabled, checked: label === model }">
    <span class="radio">
      <span class="inner"/>
      <input type="radio" :disabled="disabled" :value="label" v-model="model">
    </span>
    <span class="label" v-if="$slots.default || label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const props = defineProps<{
  modelValue?: any
  label?: string
  disabled?: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

</script>

<style lang="scss" scoped>

.k-radio {
  cursor: pointer;
  user-select: none;
  display: inline-block;
  transition: 0.3s ease;
  line-height: 1em;
  vertical-align: text-top;

  > .radio {
    outline: 0;
    line-height: 1em;
    margin-right: 0.75em;

    > span {
      vertical-align: bottom;
      position: relative;
      display: inline-block;
      box-sizing: border-box;
      transition: 0.3s ease;
      background-color: transparent;
      border: 0.08em solid var(--border);
      border-radius: 100%;
      width: 1em;
      height: 1em;
    }

    > span::after {
      content: '';
      width: 0.3em;
      height: 0.3em;
      left: 50%;
      top: 50%;
      position: absolute;
      border-radius: 100%;
      background-color: var(--bg0);
      transform: translate(-50%, -50%) scale(0);
      transform-origin: center;
      transition: transform .15s ease-in;
    }

    > input {
      position: absolute;
      opacity: 0;
      outline: 0;
      margin: 0;
      width: 0;
      height: 0;
      z-index: -1;
    }
  }

  > .label {
    line-height: 1em;
    vertical-align: middle;
  }

  &:not(.checked):hover {
    color: var(--fg0);

    > .radio > span {
      background-color: var(--bg1);
      border-color: var(--border-dark);
      box-shadow: var(--hover-inset);
    }
  }

  &.checked {
    color: var(--primary);

    > .radio > span {
      background-color: var(--primary);
      border-color: var(--primary);
      &::after {
        transform: translate(-50%, -50%) scale(1);
      }
    }
  }

  &.disabled {
    cursor: default;
    color: var(--fg2);

    > .label {
      cursor: text !important;
      user-select: text;
    }

    > .radio > span {
      box-shadow: none !important;
      border-color: transparent !important;
      background-color: var(--bg1) !important;
    }

    &.checked {
      color: var(--fg2);
      > .radio > span {
        background-color: var(--bg1) !important;
        &::after {
          border-color: var(--fg2) !important;
        }
      }
    }
  }
}

</style>
