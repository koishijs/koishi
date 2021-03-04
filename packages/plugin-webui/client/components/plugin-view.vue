<template>
  <li>
    <span :class="data.sideEffect ? 'indisposable' : 'disposable'">{{ data.name }}</span>
    <ul v-if="data.children.length">
      <plugin-view :data="data" v-for="(data, index) in data.children" :key="index" />
    </ul>
  </li>
</template>

<script setup lang="ts">

import { defineProps } from 'vue'

const { data } = defineProps(['data'])

</script>

<style lang="scss" scoped>

.disposable {
  color: green;
}

.indisposable {
  color: red;
}

</style>
