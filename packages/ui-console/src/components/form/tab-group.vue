<template>
  <div class="k-tab-group-title">
    <slot></slot>
  </div>
  <k-tab-item
    v-for="(item, key) in data" :key="getLabel(item, key)"
    :label="getLabel(item, key)" :readonly="readonly?.(item)" v-model="model"/>
</template>

<script lang="ts" setup>

import { computed } from 'vue'

const props = defineProps<{
  data: object
  modelValue: string
  label?: (item: any) => string
  readonly?: (item: any) => boolean
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

function getLabel(item: any, key: string) {
  if (props.label) return props.label(item)
  return key
}

</script>

<style lang="scss">

.k-tab-group-title {
  line-height: 2.25rem;
  padding: 0 2rem !important;
  font-weight: bold;
}

.k-tab-group-title:not(.k-select-item) {
  margin-top: 0.5rem;
}

</style>
