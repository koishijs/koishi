<template>
  <template v-if="Object.keys(store.market).length">
    <div class="market-search">
      <el-input v-model="query" #suffix>
        <k-icon name="search"></k-icon>
      </el-input>
    </div>
    <div class="market-filter">
      共搜索到 {{ plugins.length }} 个插件。
      <el-checkbox v-model="config.showInstalled">显示已下载的插件</el-checkbox>
    </div>
    <div class="market-container">
      <package-view v-for="data in packages" :key="data.name" :data="data" @query="query = $event"></package-view>
    </div>
  </template>
  <k-comment v-else type="error" class="market-error">
    <p>无法连接到插件市场。这可能是以下原因导致的：</p>
    <ul>
      <li>无法连接到网络，请检查你的网络连接和代理设置</li>
      <li>您所用的 registry 不支持搜索功能 (如 npmmirror)，请考虑进行更换</li>
    </ul>
  </k-comment>
</template>

<script setup lang="ts">

import { store } from '@koishijs/client'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { config } from '../utils'
import { validate } from './utils'
import PackageView from './package.vue'

function join(source: string | string[]) {
  return Array.isArray(source) ? source.join(' ') : source || ''
}

const route = useRoute()
const router = useRouter()

const query = computed<string>({
  get() {
    return join(route.query.keyword)
  },
  set(value) {
    const { keyword, ...rest } = route.query
    if (value) {
      router.replace({ query: { keyword: value, ...rest } })
    } else {
      router.replace({ query: rest })
    }
  },
})

const plugins = computed(() => {
  return Object.values(store.market).filter(data => validate(data, query.value))
})

const packages = computed(() => {
  return plugins.value
    .filter(item => config.showInstalled || !store.packages[item.name])
    .sort((a, b) => b.score - a.score)
})

</script>

<style lang="scss">

.market-search {
  margin: 2rem 2rem 0;
  display: flex;
  justify-content: center;

  .el-input {
    max-width: 600px;
    line-height: 3rem;
  }

  .el-input__inner {
    height: 3rem;
    border-radius: 2rem;
    font-size: 1.25rem;
    padding: 0 3rem 0 1.25rem;
    background-color: var(--card-bg);
    transition: background-color 0.3s ease, border-color 0.3s ease;
  }

  .el-input__suffix {
    right: 1.25rem;

    .k-icon {
      height: 1.25rem;
    }
  }
}

.market-filter {
  width: 100%;
  margin: 0.5rem 0 -0.5rem;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-regular);
  font-size: var(--el-font-size-base);
  font-weight: var(--el-font-weight-primary);
  transition: color 0.3s ease;

  .el-checkbox {
    margin-left: 1.5rem;
  }
}

.market-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 2rem;
  margin: 2rem;
  justify-items: center;
}

.market-error.k-comment {
  margin-left: 2rem;
  margin-right: 2rem;
}

</style>
