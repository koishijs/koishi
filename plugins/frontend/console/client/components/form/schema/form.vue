<template>
  <form class="schema-form">
    <slot name="header"></slot>
    <k-schema :schema="schema" :disabled="disabled" v-model="config"></k-schema>
    <slot name="footer"></slot>
  </form>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import Schema from 'schemastery'

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
  disabled: Boolean,
})

const emit = defineEmits(['update:modelValue'])

const config = computed({
  get: () => props.modelValue,
  set: emit.bind(null, 'update:modelValue'),
})

</script>

<style lang="scss">

.schema-form {
  h2 {
    font-size: 1.25rem;
  }
}

</style>
