<template>
  <label class="k-checkbox" :class="{ disabled, checked: modelValue }">
    <span class="checkbox">
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

.k-checkbox {
  cursor: pointer;
  user-select: none;
  display: inline-block;
  transition: 0.3s ease;
  line-height: 1em;
  vertical-align: text-top;

  > .checkbox {
    outline: 0;
    line-height: 1em;
    margin-right: 0.4em;

    > span {
      vertical-align: bottom;
      position: relative;
      display: inline-block;
      box-sizing: border-box;
      transition: 0.3s ease;
      background-color: transparent;
      border: 0.08em solid var(--border);
      border-radius: 2px;
      width: 1em;
      height: 1em;
    }

    > span::after {
      content: '';
      box-sizing: content-box;
      border: 0.08em solid var(--bg0);
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

    > .checkbox > span {
      background-color: var(--bg1);
      border-color: var(--border-dark);
      box-shadow: var(--hover-inset);
    }
  }

  &.checked {
    color: var(--active);

    > .checkbox > span {
      background-color: var(--active);
      border-color: var(--active);
      &::after {
        transform: rotate(45deg) scaleY(1);
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

    > .checkbox > span {
      box-shadow: none !important;
      border-color: transparent !important;
      background-color: var(--bg1) !important;
    }

    &.checked {
      color: var(--fg2);
      > .checkbox > span {
        background-color: var(--bg1) !important;
        &::after {
          border-color: var(--fg2) !important;
        }
      }
    }
  }
}

</style>
