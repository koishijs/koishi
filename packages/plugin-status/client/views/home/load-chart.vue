<template>
  <k-card class="load-chart" title="负载状态">
    <load-bar title="CPU" :rate="status.cpu"/>
    <load-bar title="内存" :rate="status.memory"/>
  </k-card>
</template>

<script setup lang="ts">

import LoadBar from './load-bar.vue'
import type { Payload } from '~/server'
import { defineProps } from 'vue'

defineProps<{ status: Payload }>()

</script>
