<template>
  <k-card title="插件列表">
    <ul class="plugin-list">
      <plugin-view :data="data" v-for="(data, index) in registry.plugins" :key="index"/>
    </ul>
  </k-card>
</template>

<script setup lang="ts">

import PluginView from './plugin-view.vue'
import { registry } from '~/client'

</script>
