<template>
  <div class="k-message">
    <template v-for="({ type, data }, index) in segment.parse(content)" :key="index">
      <span v-if="type === 'text'">{{ data.content }}</span>
      <img v-else-if="type === 'image'" :src="data.url || data.file"/>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'
import { segment } from '~/client'

defineProps<{
  content: string
}>()

</script>

<style lang="scss" scoped>

.k-message {
  white-space: break-spaces;

  img {
    max-height: 400px;
  }
}

</style>
