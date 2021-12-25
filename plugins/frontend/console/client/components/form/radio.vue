<template>
  <label class="k-radio k-checker" :class="{ disabled, checked: label === model }">
    <span class="checker">
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
  label?: string | number
  disabled?: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

</script>

<style lang="scss" scoped>

@import './shared.scss';

.k-radio {
  > .checker {
    > span.inner {
      border-radius: 100%;
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
  }

  &.checked > .checker > span::after {
    transform: translate(-50%, -50%) scale(1);
  }
}

</style>
