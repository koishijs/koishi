<template>
  <el-card header="负载状态" shadow="hover">
    <load-bar title="CPU" :rate="status.cpu"/>
    <load-bar title="内存" :rate="status.memory"/>
  </el-card>
</template>

<script setup lang="ts">

import LoadBar from './load-bar.vue'
import type { Payload } from '~/server'
import { defineProps } from 'vue'

defineProps<{ status: Payload }>()

</script>
