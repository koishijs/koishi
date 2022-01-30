<template>
  <div class="k-input" :class="{ focused, disabled, hidden }">
    <span class="prefix">
      <slot name="prefix"></slot>
    </span>
    <input
      :value="modelValue"
      :type="type"
      :style="inputStyle"
      :tabindex="tabindex"
      :disabled="disabled"
      :placeholder="placeholder"
      :class="{
        invalid,
        'round-left': roundLeft,
        'round-right': roundRight,
        'ortho-left': orthoLeft,
        'ortho-right': orthoRight,
      }"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @paste="$emit('paste', $event)"
      @keydown.enter.stop="$emit('enter', $event)"
    />
    <span class="suffix">
      <slot name="suffix"></slot>
    </span>
  </div>
</template>

<script lang="ts" setup>

import { ref, computed } from 'vue'

const props = defineProps({
  prefix: String,
  suffix: String,
  placeholder: String,
  disabled: Boolean,
  validate: Function,
  tabindex: Number,
  hidden: Boolean,
  roundLeft: Boolean,
  roundRight: Boolean,
  orthoLeft: Boolean,
  orthoRight: Boolean,
  modelValue: [ String, Number ],
  type: { default: 'text' },
  size: { default: 1 },
})

const focused = ref(false)
const invalid = ref(false)

const inputStyle = computed(() => ({
  fontSize: props.size + 'em',
  paddingLeft: +!!(props.prefix) + 1 + 'em',
  paddingRight: +!!(props.suffix) + 1 + 'em',
}))

const emit = defineEmits(['update:modelValue', 'paste', 'focus', 'blur', 'enter'])

function onInput(event) {
  if (props.validate) {
    invalid.value = !props.validate(event.target.value)
  }
  emit('update:modelValue', event.target.value)
}

function onFocus(event) {
  focused.value = true
  emit('focus', event)
}

function onBlur(event) {
  focused.value = false
  emit('blur', event)
}

</script>

<style lang="scss" scoped>

.k-input {
  height: 2em;
  position: relative;
  transition: 0.3s ease;
  position: relative;
  display: inline-block;

  > .prefix, > .suffix {
    color: var(--fg3);
    top: 50%;
    position: absolute;
    transform: translateY(-50%);
    transition: 0.3s ease;
    line-height: 1;
  }
  > .prefix {
    left: 10px;
  }
  > .suffix {
    right: 10px;
  }

  > input {
    padding: 0;
    width: 100%;
    outline: none;
    font-size: 1em;
    height: inherit;
    display: inline-block;
    border-radius: 0.3em;
    transition: 0.3s ease;
    box-sizing: border-box;
    appearance: none;
    background-color: transparent;
    border: 1px solid var(--border);

    &:hover:not(:disabled) {
      border-color: var(--border-dark);
      background-color: var(--bg1);
      box-shadow: var(--hover-inset);
    }
    &:focus:not(:disabled) {
      border-color: var(--primary);
      background-color: var(--bg1);
    }

    &::-webkit-input-placeholder {
      color: var(--fg2);
      user-select: none;
    }
    &:disabled::-webkit-input-placeholder {
      opacity: 0.5;
    }
  }

  &.round > input {
    border-radius: 1rem;
  }
  &.ortho > input {
    border-radius: 0;
  }

  &.hidden > input {
    border: none;
  }
}

</style>