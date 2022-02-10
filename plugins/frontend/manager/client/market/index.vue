<template>
  <div class="market-search">
    <el-input v-model="keyword" #suffix>
      <k-icon name="search"></k-icon>
    </el-input>
  </div>
  <div class="market-container">
    <k-card class="market-view" v-for="data in packages" :key="data.name">
      <template #header>
        {{ data.shortname }}<k-icon v-if="data.official" name="check-full"></k-icon>
        <k-button v-if="!config.override[data.name]" solid class="right" @click="addFavorite(data.name)">添加</k-button>
        <k-button v-else solid type="warning" class="right" @click="removeFavorite(data.name)">取消</k-button>
      </template>
      <k-markdown inline tag="p" class="desc" :source="data.description"></k-markdown>
      <template #footer>
        <div class="info">
          <span><k-icon name="user"></k-icon>{{ data.author }}</span>
          <span><k-icon name="balance"></k-icon>{{ data.license }}</span>
          <span><k-icon name="tag"></k-icon>{{ data.version }}</span>
          <span><k-icon name="file-archive"></k-icon>{{ Math.ceil(data.size / 1000) }} KB</span>
        </div>
      </template>
    </k-card>
  </div>
</template>

<script setup lang="ts">

import { store } from '~/client'
import { ref, computed } from 'vue'
import { addFavorite, removeFavorite, config } from '../utils'

const keyword = ref('')

const packages = computed(() => {
  return Object.values(store.market)
    .filter(item => item.shortname.includes(keyword.value))
    .filter(item => !store.packages[item.name])
    .sort((a, b) => b.score - a.score)
    .sort((a, b) => +b.official - +a.official)
})

</script>

<style lang="scss">

.market-search {
  margin: 2rem;
}

.market-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 2rem;
  margin: 2rem;
  justify-items: center;
}

.market-view {
  width: 100%;
  height: 200px;
  margin: 0;
  display: flex;
  flex-direction: column;

  .k-card-body {
    margin: 0;
    height: 100%;
  }

  .desc {
    margin: -0.5rem 0;
  }

  header, footer {
    flex-shrink: 0;
  }

  .right {
    position: absolute;
    right: 1rem;
    top: -4px;
  }

  .info {
    font-size: 14px;
    color: var(--el-text-color-regular);

    .k-icon {
      height: 12px;
      margin-right: 8px;
      vertical-align: -1px;
    }

    span + span {
      margin-left: 1.5rem;
    }
  }
}

</style>
