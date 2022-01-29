<template>
  <k-schema v-if="choices.length === 1" :schema="choices[0]" v-model="modelValue">
    <slot></slot>
  </k-schema>

  <!-- <template v-else-if="choices.length">
    <div class="schema">
      <div class="schema-header">
        <div class="left">
          <slot></slot>
          <p>{{ schema.meta.description }}</p>
        </div>
      </div>
    </div>
  </template> -->
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

const selected = ref<number>(null)

</script>
