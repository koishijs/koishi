<template>
  <k-card class="page-config frameless">
    <plugin-select v-model="current"></plugin-select>
    <plugin-settings :current="current"></plugin-settings>
  </k-card>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import PluginSelect from './select.vue'
import PluginSettings from './settings.vue'

const current = ref<string>('')

</script>

<style lang="scss">

.page-config .k-card-body {
  height: calc(100vh - 4rem);
}

</style>
