<template>
  <k-card-aside class="page-market">
    <template #aside>
      <div class="search">
        <k-input v-model="keyword" #suffix>
          <k-icon name="search"></k-icon>
        </k-input>
      </div>
      <el-scrollbar>
        <div class="content">
          <div
            v-for="data in packages" :key="data.name"
            :class="['k-menu-item', { active: data.name === current }]"
            @click="current = data.name">
            {{ data.shortname }}
            <k-icon v-if="data.official" name="check-full"></k-icon>
          </div>
        </div>
      </el-scrollbar>
    </template>
    <k-content v-if="current">
      <k-button solid @click="addFavorite(current)">添加插件</k-button>
      <k-markdown :source="store.market[current].readme"></k-markdown>
    </k-content>
  </k-card-aside>
</template>

<script setup lang="ts">

import { store } from '~/client'
import { ref, computed } from 'vue'
import { addFavorite } from '../utils'

const current = ref<string>(null)
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

.page-market {
  height: calc(100vh - 4rem);

  .k-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  aside {
    display: flex;
    flex-direction: column;
  }

  .search {
    padding: 1rem 2rem;
  }

  .content {
    padding: 0 0 1rem;
    line-height: 2.25rem;
  }

  .k-menu-item {
    padding: 0 2rem;
    white-space: nowrap;
    overflow: auto;
    text-overflow: ellipsis;

    .k-icon {
      color: var(--success);
      vertical-align: -2px;
    }
  }
}

</style>
