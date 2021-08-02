<template>
  <div class="k-input" :class="{ focused, disabled }">
    <i v-if="prefix" :class="prefix" class="prefix" @click="$emit('click-prefix')"/>
    <input
      :value="modelValue"
      :type="type"
      :style="inputStyle"
      :tabindex="tabindex"
      :disabled="disabled"
      :placeholder="placeholder"
      :class="{ invalid }"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @paste="$emit('paste', $event)"
      @keydown.enter.stop="$emit('enter', $event)"
    />
    <i v-if="suffix" :class="suffix" class="suffix" @click="$emit('click-suffix')"/>
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

const emit = defineEmits(['update:modelValue', 'paste', 'focus', 'blur', 'enter', 'click-prefix', 'click-suffix'])

function onInput(event) {
  if (props.validate) {
    invalid.value = !props.validate(event.target.value)
  }
  emit('update:modelValue', event.target.value)
}

function onFocus(event: FocusEvent) {
  focused.value = true
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
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

  > i.prefix, > i.suffix {
    color: var(--c-text);
    top: 50%;
    position: absolute;
    margin-top: -0.5em;
  }
  > i.prefix {
    left: 10px;
  }
  > i.suffix {
    right: 10px;
  }

  > input {
    padding: 0;
    width: 100%;
    color: var(--c-text);
    outline: none;
    font-size: 1em;
    height: inherit;
    display: inline-block;
    border-radius: 0.3em;
    transition: 0.3s ease;
    box-sizing: border-box;
    appearance: none;
    background-color: transparent;
    border: 1px solid var(--c-border);
  
    &:hover:not(:disabled) {
      border-color: var(--c-border-dark);
      background-color: var(--c-bg-light);
      box-shadow: 0 0 4px 1px inset var(--c-input-inset);
    }
    &:focus:not(:disabled) {
      border-color: var(--c-border-active);
      background-color: var(--c-bg-lighter);
      box-shadow: 0 0 8px 2px inset var(--c-input-inset);
    }

    &::-webkit-input-placeholder {
      color: var(--c-text-lighter);
      user-select: none;
    }
    &:hover:not(:disabled)::-webkit-input-placeholder {
      color: var(--c-text-lighter);
    }
    &:focus:not(:disabled)::-webkit-input-placeholder {
      color: var(--c-text-lighter);
    }
    &:disabled::-webkit-input-placeholder {
      color: var(--c-text-lightest);
    }
  }

  &.round > input {
    border-radius: 1rem;
  }
  &.ortho > input {
    border-radius: 0;
  }
}

</style>