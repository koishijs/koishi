<template>
  <template v-if="schema.type === 'object'">
    <div class="schema" v-for="(item, key) in schema.props">
      <h3>{{ key }}</h3>
      <template v-if="item.type === 'string' || item.type === 'number'">
        <p>{{ item.desc }}</p>
        <p v-if="item._default">默认值：{{ item._default }}</p>
        <k-input v-model="config[key]" style="width: 28rem"/>
      </template>
      <template v-else-if="item.type === 'boolean'">
        <el-checkbox v-model="config[key]">{{ item.desc }}</el-checkbox>
      </template>
    </div>
  </template>
  <template v-else-if="schema.type === 'merge'">
    <template v-for="item in schema.values">
      <div class="schema-group" v-if="item.desc">
        <h2>{{ item.desc }}</h2>
        <div class="schema-group-body">
          <schema-view :schema="item" :config="config"/>
        </div>
      </div>
      <schema-view v-else :schema="item" :config="config"/>
    </template>
  </template>
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

  h3 {
    font-size: 1.25em;
  }

  h3, p {
    margin: 0.625rem 0;
    line-height: 1.6;
  }
}

.schema-group {
  h2 {
    font-size: 1.25em;
    margin: 0 0 -1.25rem;
  }
}

.schema-group-body {
  padding-left: 1.5rem;
}

</style>
