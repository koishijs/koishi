<template>
  <div class="k-message">
    <template v-for="({ type, data }, index) in segment.parse(content)" :key="index">
      <span v-if="type === 'text'">{{ data.content }}</span>
      <span v-else-if="type === 'quote'">[引用回复]</span>
      <img v-else-if="type === 'image'" :src="normalizeUrl(data.url)"/>
    </template>
  </div>
</template>

<script lang="ts" setup>

import { defineProps } from 'vue'
import { segment } from '~/client'

defineProps<{
  content: string
}>()

function normalizeUrl(url: string) {
  if (!KOISHI_CONFIG.whitelist.some(prefix => url.startsWith(prefix))) return url
  return KOISHI_CONFIG.endpoint + '/assets/' + encodeURIComponent(url)
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
