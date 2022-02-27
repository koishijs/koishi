<template>
  <img :src="$withBase(imgset[index])" @click="index = (index + 1) % 5">
</template>

<script lang="ts" setup>

import { ref } from 'vue'

const index = ref(0)

const imgset = [
  '/console/bot.png',
  '/console/logger.png',
  '/console/market.png',
  '/console/settings.png',
  '/console/status.png',
]

</script>
