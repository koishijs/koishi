<template>
  <label class="k-checkbox k-checker" :class="{ disabled, checked: modelValue }">
    <span class="checker">
      <span class="inner"/>
      <input type="checkbox" :disabled="disabled" :value="label" v-model="modelValue">
    </span>
    <span class="label" v-if="$slots.default || label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script lang="ts" setup>

defineProps<{
  modelValue?: boolean
  label?: string
  disabled?: boolean
}>()

</script>

<style lang="scss" scoped>

@import './shared.scss';

.k-checkbox {
  > .checker {
    > span.inner {
      border-radius: 2px;
    }

    > span::after {
      content: '';
      box-sizing: content-box;
      border: 0.13em solid var(--bg0);
      border-left: 0;
      border-top: 0;
      height: 0.5em;
      left: 0.31em;
      top: 0.08em;
      width: 0.21em;
      position: absolute;
      transform: rotate(45deg) scaleY(0);
      transform-origin: center;
      transition: transform .15s ease-in .05s;
    }
  }

  &.checked > .checker > span::after {
    transform: rotate(45deg) scaleY(1);
  }
}

</style>
