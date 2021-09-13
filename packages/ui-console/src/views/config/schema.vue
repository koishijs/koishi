<template>
  <div v-for="(value, key) in schema.props">
    <h3>{{ key }}</h3>
    <p>{{ value.desc }}</p>
    <p v-if="value.type === 'string' || value.type === 'number'">
      <k-input v-model="config[key]" style="width: 20rem"/>
    </p>
  </div>
</template>

<script lang="ts" setup>

import { Schema } from '@koishijs/utils'

defineProps<{
  schema: Schema
  config: any
}>()

</script>
