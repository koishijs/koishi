<template>
  <k-card class="market-view">
    <template #header>
      {{ data.shortname }}
      <a v-if="repo" :href="data.links.repository" target="_blank" rel="noopener noreferrer">
        <k-icon :name="repo"></k-icon>
      </a>
      <k-button v-if="store.packages[data.name]" type="success" class="right" disabled>本地</k-button>
      <k-button v-else-if="!config.override[data.name]" solid class="right" @click="addFavorite(data.name)">添加</k-button>
      <k-button v-else solid type="warning" class="right" @click="removeFavorite(data.name)">取消</k-button>
    </template>
    <k-markdown inline tag="p" class="desc" :source="data.description"></k-markdown>
    <div class="badges">
      <k-badge v-if="data.official" type="success">官方</k-badge>
      <k-badge v-if="keywords.includes('impl:database')" type="primary">数据库</k-badge>
      <k-badge v-if="keywords.includes('impl:adapter')" type="primary">适配器</k-badge>
      <k-badge v-if="keywords.includes('impl:assets')" type="primary">资源存储</k-badge>
      <k-badge v-if="keywords.includes('required:console') || keywords.includes('optional:console')" type="primary">控制台</k-badge>
    </div>
    <template #footer>
      <div class="info">
        <span><k-icon name="user"></k-icon>{{ data.author.name }}</span>
        <span><k-icon name="balance"></k-icon>{{ data.license }}</span>
        <span><k-icon name="tag"></k-icon>{{ data.version }}</span>
        <span><k-icon name="file-archive"></k-icon>{{ Math.ceil(data.size / 1000) }} KB</span>
      </div>
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import { MarketProvider } from '@koishijs/plugin-manager'
import { store } from '~/client'
import { config, addFavorite, removeFavorite } from '../utils'

const props = defineProps({
  data: {} as PropType<MarketProvider.Data>,
})

const keywords = computed(() => {
  return store.packages[props.data.name]?.keywords || props.data.keywords || []
})

const repo = computed(() => {
  const { repository = '' } = props.data.links
  if (repository.startsWith('https://github.com')) {
    return 'github'
  }
})

</script>

<style lang="scss">

.market-view {
  width: 100%;
  height: 192px;
  margin: 0;
  display: flex;
  flex-direction: column;

  .k-card-body {
    margin: 0;
    flex-grow: 1;
    overflow: hidden;
  }

  .desc {
    margin: -6px 0;
    font-size: 15px;
  }

  .badges {
    margin-top: 1.5rem;
  }

  header, footer {
    flex-shrink: 0;
  }

  header .k-icon {
    margin-left: 0.5rem;
    height: 1.25rem;
    vertical-align: -2px;
  }

  .right {
    position: absolute;
    right: 1rem;
    top: -2px;
  }

  .info {
    font-size: 14px;
    color: var(--el-text-color-regular);
    transition: color 0.3s ease;

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
