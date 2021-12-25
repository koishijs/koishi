<template>
  <div class="k-input" :class="{ focused, disabled }">
    <i v-if="prefix" :class="'fas fa-' + prefix" class="prefix" @click="$emit('clickPrefix')"/>
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
    <i v-if="suffix" :class="'fas fa-' + suffix" class="suffix" @click="$emit('clickSuffix')"/>
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

const emit = defineEmits(['update:modelValue', 'paste', 'focus', 'blur', 'enter', 'clickPrefix', 'clickSuffix'])

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

  > i.prefix, > i.suffix {
    color: var(--fg2);
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
}

</style>