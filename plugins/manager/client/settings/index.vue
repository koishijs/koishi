<template>
  <k-card-aside class="page-settings">
    <template #aside>
      <plugin-select v-model="current"></plugin-select>
    </template>
    <plugin-settings :current="current"></plugin-settings>
  </k-card-aside>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import PluginSelect from './select.vue'
import PluginSettings from './settings.vue'

const current = ref<string>('')

</script>

<style lang="scss">

</style>
