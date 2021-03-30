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
      @keydown.enter.stop="$emit('enter', $event)"
    />
    <i v-if="suffix" :class="'fas fa-' + suffix" class="suffix" @click="$emit('clickSuffix')"/>
  </div>
</template>

<script lang="ts" setup>

import { defineProps, ref, computed, defineEmit } from 'vue'

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

const emit = defineEmit(['update:modelValue', 'focus', 'blur', 'enter', 'clickPrefix', 'clickSuffix'])

function onInput (event) {
  if (props.validate) {
    invalid.value = !props.validate(event.target.value)
  }
  emit('update:modelValue', event.target.value)
}

function onFocus (event) {
  focused.value = true
  emit('focus', event)
}

function onBlur (event) {
  focused.value = false
  emit('blur', event)
}

</script>

<style lang="scss" scoped>

@import '../index.scss';

.k-input {
  height: 2em;
  position: relative;
  transition: 0.3s ease;
  position: relative;
  display: inline-block;

  > i.prefix, > i.suffix {
    color: $tpColor1;
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
    color: white;
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
    border: 1px solid $tpBorderColor1;
    &:hover:not(:disabled) {
      border-color: $tpBorderColor2;
      background-color: $tpBgColor1;
      box-shadow: 0 0 4px 1px inset $tpInsetColor;
    }
    &:focus:not(:disabled) {
      border-color: #409eff;
      background-color: $tpBgColor2;
      box-shadow: 0 0 8px 2px inset $tpInsetColor;
    }
    &::-webkit-input-placeholder {
      color: $tpColor1;
      user-select: none;
    }
    &:hover:not(:disabled)::-webkit-input-placeholder {
      color: $tpColor2;
    }
    &:focus:not(:disabled)::-webkit-input-placeholder {
      color: $tpColor3;
    }
    &:disabled::-webkit-input-placeholder {
      color: $tpFgColor2;
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