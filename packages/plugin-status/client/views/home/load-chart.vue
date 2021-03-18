<template>
  <k-card class="load-chart" title="负载状态">
    <load-bar title="CPU" :rate="profile.cpu"/>
    <load-bar title="内存" :rate="profile.memory"/>
  </k-card>
</template>

<script setup lang="ts">

import LoadBar from './load-bar.vue'
import { profile } from '~/client'

</script>
