<template>
  <div class="search-box"></div>
  <div class="market-container">
    <package-view v-for="data in market.packages" :key="data.name" :data="data" v-model:query="query"></package-view>
  </div>
</template>

<script lang="ts" setup>

import { onMounted, ref } from 'vue'
import market from '../../.data/market.json'
import PackageView from './package.vue'

const query = ref('')

</script>

<style lang="scss">

$max-width: 480px;
$min-width: 420px;

.market-container {
  display: grid;
  gap: 2rem;
  margin: var(--navbar-height) auto 0;
  padding: 2rem 2rem;
  justify-items: center;
  justify-content: center;

  .package-view {
    max-width: $max-width;
  }

  @media (min-width: 2 * $max-width + 90px) {
    grid-template-columns: repeat(2, $max-width);
  }

  @media (max-width: 2 * $max-width + 90px) and (min-width: 2 * $min-width + 90px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 2 * $min-width + 90px) {
    grid-template-columns: 1fr;
  }
}

</style>
