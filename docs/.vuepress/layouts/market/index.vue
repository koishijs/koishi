<template>
  <div class="market">{{ market }}</div>
</template>

<script lang="ts" setup>

import market from '../../.data/market.json'
import { onMounted } from 'vue'

</script>

<style lang="scss">

.market {
  margin-top: var(--navbar-height);
}

</style>
