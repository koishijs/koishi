<template>
  <div v-for="(value, key) in schema.props">
    <h3>{{ key }}</h3>
    <div>{{ value.desc }}</div>
    <template v-if="value.type === 'string' || value.type === 'number'">
      <k-input/>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { Schema } from '@koishijs/utils'

defineProps<{
  schema: Schema
  config: any
}>()

</script>
