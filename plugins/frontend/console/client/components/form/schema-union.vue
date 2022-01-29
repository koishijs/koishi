<template>
  <k-schema v-if="choices.length === 1" :schema="choices[0]" v-model="modelValue">
    <slot></slot>
  </k-schema>

  <div class="schema" v-else>
    <slot></slot>
    <ul v-if="choices.every(item => item.type === 'const')">
      <li v-for="item in choices" :key="item.value">
        <k-radio :label="item.value" v-model="selected">{{ item.meta.description }}</k-radio>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>

import { computed, ref } from 'vue'
import type { PropType } from 'vue'
import Schema from 'schemastery'

const props = defineProps({
  schema: {} as PropType<Schema>,
  modelValue: {},
})

const choices = computed(() => {
  return props.schema.list.filter(item => item.type !== 'transform')
})

const selected = ref(props.schema.meta.default)

</script>
