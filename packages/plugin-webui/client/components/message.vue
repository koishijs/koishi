<template>
  <div class="k-message">
    <template v-for="({ type, data }, index) in segment.parse(content)" :key="index">
      <span v-if="type === 'text'">{{ data.content }}</span>
      <img v-else-if="type === 'image'" :src="normalizeUrl(data)"/>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'
import { segment } from '~/client'

defineProps<{
  content: string
}>()

function normalizeUrl(data: any) {
  if (!data.url) return console.log(data), ''
  if (data.url.startsWith('base64://')) return data.url
  return KOISHI_CONFIG.endpoint + '/assets/' + encodeURIComponent(data.url)
}

</script>

<style lang="scss" scoped>

.k-message {
  white-space: break-spaces;
  line-height: 1.5;

  img {
    max-height: 400px;
  }
}

</style>
