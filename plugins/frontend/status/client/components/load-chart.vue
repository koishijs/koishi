<template>
  <k-card v-if="store.profile" class="load-chart" title="负载状态">
    <load-bar title="CPU" :rate="store.profile.cpu"/>
    <load-bar title="内存" :rate="store.profile.memory"/>
  </k-card>
</template>

<script setup lang="ts">

import LoadBar from './load-bar.vue'
import { store } from '@koishijs/client'

</script>
