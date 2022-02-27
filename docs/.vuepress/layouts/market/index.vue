<template>
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

.market-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 2rem;
  margin: 5rem 2rem 2rem;
  justify-items: center;
}

</style>
