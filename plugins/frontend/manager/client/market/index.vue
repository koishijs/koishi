<template>
  <template v-if="plugins.length">
    <div class="search-box">
      <k-badge type="success" v-for="(word, index) in words.slice(0, -1)" :key="index" @click="words.splice(index, 1)">{{ word }}</k-badge>
      <input
        placeholder="输入想要查询的插件名"
        v-model="words[words.length - 1]"
        @blur="onEnter"
        @keydown.escape="onEscape"
        @keydown.backspace="onBackspace"
        @keypress.enter.prevent="onEnter"
        @keypress.space.prevent="onEnter"/>
      <k-icon name="search"></k-icon>
    </div>
    <div class="market-filter">
      共搜索到 {{ realWords.length ? packages.length + ' / ' : '' }}{{ Object.keys(store.market).length }} 个插件。
      <el-checkbox v-model="config.showInstalled">显示已下载的插件</el-checkbox>
    </div>
    <div class="market-container">
      <package-view v-for="data in packages" :key="data.name" :data="data" @query="onQuery"></package-view>
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

import { router, store } from '@koishijs/client'
import { computed, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { config } from '../utils'
import { validate } from './utils'
import PackageView from './package.vue'

const route = useRoute()

const { keyword } = route.query
const words = reactive(Array.isArray(keyword) ? keyword : (keyword || '').split(' '))
if (words[words.length - 1]) words.push('')

const realWords = computed(() => words.filter(w => w))

watch(words, () => {
  const { keyword: _, ...rest } = route.query
  const keyword = realWords.value.join(' ')
  if (keyword) {
    router.replace({ query: { keyword, ...rest } })
  } else {
    router.replace({ query: rest })
  }
}, { deep: true })

function onEnter(event: Event) {
  const last = words[words.length - 1]
  if (!last) return
  if (words.slice(0, -1).includes(last)) {
    words.pop()
  }
  words.push('')
}

function onEscape(event: KeyboardEvent) {
  words[words.length - 1] = ''
}

function onBackspace(event: KeyboardEvent) {
  if (words[words.length - 1] === '' && words.length > 1) {
    event.preventDefault()
    words.splice(words.length - 2, 1)
  }
}

function onQuery(word: string) {
  if (!words[words.length - 1]) words.pop()
  if (!words.includes(word)) words.push(word)
  words.push('')
}

const plugins = computed(() => {
  return Object.values(store.market).filter(data => data.shortname)
})

const packages = computed(() => {
  return plugins.value
    .filter(data => words.every(word => validate(data, word)))
    .filter(item => config.showInstalled || !store.packages[item.name])
    .sort((a, b) => b.popularity - a.popularity)
})

</script>

<style lang="scss">

.search-box {
  margin: 2rem auto 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 600px;
  max-width: 600px;
  height: 3rem;
  border-radius: 1.5rem;
  background-color: var(--card-bg);
  align-items: center;
  padding: 0 1.2rem;
  transition: var(--color-transition);

  input {
    height: 3rem;
    width: 100%;
    font-size: 1em;
    background-color: transparent;
    border: none;
    outline: none;
    color: var(--fg1);
    transition: var(--color-transition);
  }

  .badge {
    flex-shrink: 0;
  }

  .badge + input {
    margin-left: 0.4rem;
  }
}

.search-box, .market-container {
  .k-badge {
    cursor: pointer;
    user-select: none;
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
