<template>
  <div v-for="(value, key) in schema.props">
    <div class="schema" v-if="value.type === 'string' || value.type === 'number'">
      <h3>{{ key }}</h3>
      <p>{{ value.desc }}</p>
      <p v-if="value._default">默认值：{{ value._default }}</p>
      <k-input v-model="config[key]" style="width: 20rem"/>
    </div>
    <div class="schema" v-else-if="value.type === 'boolean'">
      <h3>{{ key }}</h3>
      <el-checkbox v-model="config[key]">{{ value.desc }}</el-checkbox>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { Schema } from '@koishijs/utils'

defineProps<{
  schema: Schema
  config: any
}>()

</script>

<style lang="scss">

.schema {
  margin: 2rem 0;

  h3, p {
    margin: 0.75rem 0;
    line-height: 1.6;
  }
}

</style>
