<template>
  <el-tooltip :placement="placement">
    <template #content>
      <div class="k-hint-content">
        <slot></slot>
      </div>
    </template>
    <span class="k-hint" :class="{ active: modelValue, pointer }" @click="onClick">
      <k-icon :name="name"/>
    </span>
  </el-tooltip>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const props = defineProps({
  placement: String,
  modelValue: {},
  name: { type: String, default: 'question-empty' },
})

const emit = defineEmits(['update:modelValue'])

const pointer = computed(() => props.modelValue !== undefined)

function onClick() {
  if (!pointer.value) return
  emit('update:modelValue', !props.modelValue)
}

</script>

<style lang="scss">

.k-hint {
  opacity: 0.5;
  color: var(--fg2);
  margin-left: 0.25rem;
  transition: 0.3s ease;
  vertical-align: -2px;

  &:hover, &.active {
    opacity: 1;
  }
}

.k-hint.pointer {
  cursor: pointer;
}

.k-hint-content {
  line-height: 1.5;
  max-width: 20rem;
}

</style>
