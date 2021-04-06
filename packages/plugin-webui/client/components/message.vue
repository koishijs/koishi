<template>
  <div class="k-message">
    <template v-for="({ type, data }, index) in segment.parse(content)" :key="index">
      <span v-if="type === 'text'">{{ data.content }}</span>
      <span v-else-if="type === 'quote'">[引用]</span>
      <span v-else-if="type === 'face'">[表情]</span>
      <k-image v-else-if="type === 'image'" :src="data.url"/>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'
import { segment } from '~/client'
import KImage from './image.vue'

defineProps<{
  content: string
}>()

</script>

<style lang="scss" scoped>

.k-message {
  white-space: break-spaces;
  line-height: 1.5;

  img {
    max-height: 400px;
    max-width: 100%;
  }
}

</style>
