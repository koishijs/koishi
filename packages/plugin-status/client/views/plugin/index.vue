<template>
  <layout>
    <el-card header="插件列表" shadow="hover">
      <ul class="plugin-list">
        <plugin-view :data="data" v-for="(data, index) in status.plugins" :key="index"/>
      </ul>
    </el-card>
  </layout>
</template>

<script setup lang="ts">

import PluginView from './plugin-view.vue'
import Layout from '../layout/index.vue'
import type { Payload } from '~/server'
import { defineProps } from 'vue'

defineProps<{ status: Payload }>()

</script>
