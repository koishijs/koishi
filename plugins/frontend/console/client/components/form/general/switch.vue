<template>
  <div class="k-switch" :class="{ checked: value }" @click.prevent="switchValue">
    <div class="k-switch-button"></div>
  </div>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const emit = defineEmits(['update:modelValue'])

const props = defineProps({
  modelValue: Boolean,
  initial: Boolean,
})

const value = computed(() => props.modelValue ?? props.initial)

function switchValue() {
  emit('update:modelValue', !value.value)
}

</script>

<style lang="scss">

.k-switch {
  margin: 0;
  display: inline-block;
  position: relative;
  width: 40px;
  height: 20px;
  outline: none;
  border-radius: 10px;
  background: var(--bg3);
  cursor: pointer;
  transition: background-color 0.3s ease;
  vertical-align: middle;

  .k-switch-button {
    position: absolute;
    top: 2px;
    left: 2px;
    border-radius: var(--el-border-radius-circle);
    transition: 0.3s ease;
    width: 16px;
    height: 16px;
    background-color: var(--bg0);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  &.checked {
    background-color: var(--default);

    .k-switch-button {
      left: 100%;
      margin-left: -18px;
      color: var(--default);
    }
  }
}

</style>
