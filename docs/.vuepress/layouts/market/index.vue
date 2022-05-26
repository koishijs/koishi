<template>
  <div class="market-container">
    <h1 class="banner">插件市场</h1>
    <div class="banner info">
      当前共有 {{ hasWords ? packages.length + ' / ' : '' }}{{ market.packages.length }} 个可用于 v4 版本的插件
      <span class="timestamp">({{ new Date(market.timestamp).toLocaleString() }})</span>
    </div>
    <div class="banner card search-box">
      <badge type="tip" v-for="(word, index) in words.slice(0, -1)" :key="index" @click="words.splice(index, 1)">{{ word }}</badge>
      <input
        placeholder="输入想要查询的插件名"
        v-model="words[words.length - 1]"
        @blur="onEnter"
        @keydown.escape="onEscape"
        @keydown.backspace="onBackspace"
        @keypress.enter.prevent="onEnter"
        @keypress.space.prevent="onEnter"/>
    </div>
    <package-view class="card"
      v-for="data in packages"
      :key="data.name"
      :data="data" @query="onQuery"/>
  </div>
</template>

<script lang="ts" setup>

import type { AnalyzedPackage } from '@koishijs/market'
import { computed, onMounted, reactive } from 'vue'
import market from '../../.data/market.json'
import PackageView from './package.vue'

const words = reactive([''])

function onEnter(event: KeyboardEvent) {
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

function validate(data: AnalyzedPackage, word: string) {
  const { locales, service } = data.manifest
  if (word.startsWith('impl:')) {
    return service.implements.includes(word.slice(5))
  } else if (word.startsWith('locale:')) {
    return locales.includes(word.slice(7))
  } else if (word.startsWith('using:')) {
    const name = word.slice(6)
    return service.required.includes(name) || service.optional.includes(name)
  } else if (word.startsWith('email:')) {
    return data.author?.email === word.slice(6)
  } else if (word.startsWith('is:')) {
    if (word === 'is:official') {
      return data.official
    } else {
      return true
    }
  }

  if (data.shortname.includes(word)) return true
  return data.keywords.some((keyword) => {
    return !keyword.includes(':') && keyword.includes(word)
  })
}

const hasWords = computed(() => {
  return words.filter(w => w).length > 0
})

const packages = computed(() => {
  return market.packages.filter((data) => {
    return words.every(word => validate(data, word))
  })
})

</script>

<style lang="scss">

$max-width: 480px;
$min-width: 420px;
$breakpoint: 2 * $min-width + 90px;

:root {
  --c-card-bg: #ffffff;
  --c-card-border: transparent;
  --c-card-badge: #ffffff;
}

html.dark {
  --c-card-bg: #1F1D26;
  --c-card-border: var(--c-border);
  --c-card-badge: var(--c-text);
}

.market-container {
  display: grid;
  column-gap: 2rem;
  margin: var(--navbar-height) auto 0;
  padding: 0 2rem 2rem;
  justify-items: center;
  justify-content: center;

  .banner {
    grid-column: 1 / -1;
  }

  > .card {
    transition: var(--color-transition);
  }

  @media (min-width: $breakpoint) {
    > .card {
      background-color: var(--c-card-bg);
      border: 1px solid var(--c-card-border);
      border-radius: 8px;
      margin-top: 2rem;
    }

    .package-view {
      height: 12rem;
      display: flex;
      flex-direction: column;
    }
  }

  > .search-box {
    display: flex;
    width: 600px;
    max-width: 600px;
    height: 3rem;
    border-radius: 1.5rem;
    background-color: var(--c-card-bg);
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
    }

    .badge {
      flex-shrink: 0;
    }

    .badge + input {
      margin-left: 0.4rem;
    }
  }

  .badge {
    cursor: pointer;
    user-select: none;
    padding: 2px 6px;
    color: var(--c-card-badge);
    font-weight: 500;
  }

  @media (min-width: 2 * $max-width + 90px) {
    grid-template-columns: repeat(2, $max-width);
  }

  @media (max-width: 2 * $max-width + 90px) and (min-width: $breakpoint) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: $breakpoint) {
    grid-template-columns: 1fr;

    .search-box {
      width: calc(100% - 2.4rem);
      margin: 2rem 0;
    }

    > .package-view {
      padding: 0.25rem 0;
      border-top: 1px solid var(--c-border);

      &:last-child {
        border-bottom: 1px solid var(--c-border);
      }

      .badge-container {
        margin: 1rem 0 1.25rem;
      }
    }
  }

  @media (max-width: 480px) {
    padding: 0 1rem 2rem;

    .search-box {
      width: calc(100% - 3.4rem);
    }

    .banner.info span.timestamp {
      display: none;
    }

    > .package-view {
      padding: 0;
    }

    > .package-view > * {
      padding: 0 1rem;
    }
  }
}

html:not(.dark) .market-container > .card {
  --shadow-left-1: 0 2px 4px hsl(250deg 40% 40% / 12%);
  --shadow-left-2: 0 4px 8px hsl(250deg 40% 40% / 12%);
  --shadow-left-3: 0 8px 16px hsl(250deg 40% 40% / 6%);
  --shadow-left-4: 0 12px 24px hsl(250deg 40% 40% / 6%);
  --shadow-right-1: 1px 2px 4px hsl(250deg 40% 40% / 12%);
  --shadow-right-2: 2px 4px 8px hsl(250deg 40% 40% / 12%);
  --shadow-right-3: 4px 8px 16px hsl(250deg 40% 40% / 6%);
  --shadow-right-4: 6px 12px 24px hsl(250deg 40% 40% / 6%);

  @media (min-width: $breakpoint) {
    box-shadow: var(--shadow-right-1), var(--shadow-right-2);

    &:hover {
      box-shadow: var(--shadow-right-3), var(--shadow-right-4);
    }

    &:nth-child(2n) {
      box-shadow: var(--shadow-left-1), var(--shadow-left-2);

      &:hover {
        box-shadow: var(--shadow-left-3), var(--shadow-left-4);
      }
    }
  }

  &.search-box {
    box-shadow: var(--shadow-right-1), var(--shadow-right-2);

    &:hover {
      box-shadow: var(--shadow-right-3), var(--shadow-right-4);
    }
  }
}

</style>
