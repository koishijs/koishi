<template>
  <k-card class="market-view">
    <template #header>
      {{ data.shortname }}
      <a v-if="repo" :href="data.links.repository" target="_blank" rel="noopener noreferrer">
        <k-icon :name="repo"></k-icon>
      </a>
      <k-button v-if="store.packages[data.name]" solid type="success" class="right" @click="router.push('/settings/' + data.name)">配置</k-button>
      <k-button v-else-if="!config.override[data.name]" solid class="right" @click="addFavorite(data.name)">添加</k-button>
      <k-button v-else solid type="warning" class="right" @click="removeFavorite(data.name)">取消</k-button>
    </template>
    <k-markdown inline tag="p" class="desc" :source="meta.description"></k-markdown>
    <div class="badges">
      <k-badge type="success"
        v-if="data.official"
        @click="$emit('query', 'is:official')"
      >官方</k-badge>
      <k-badge type="primary"
        v-if="meta.keywords.includes('impl:database')"
        @click="$emit('query', 'impl:database')"
      >数据库</k-badge>
      <k-badge type="primary"
        v-if="meta.keywords.includes('impl:adapter')"
        @click="$emit('query', 'impl:adapter')"
      >适配器</k-badge>
      <k-badge type="primary"
        v-if="meta.keywords.includes('impl:assets')"
        @click="$emit('query', 'impl:assets')"
      >资源存储</k-badge>
      <k-badge type="primary"
        v-if="meta.keywords.includes('required:console') || meta.keywords.includes('optional:console')"
        @click="$emit('query', 'using:console')"
      >控制台</k-badge>
    </div>
    <template #footer>
      <div class="info">
        <span :class="{ pointer: author }" @click="author && $emit('query', 'author:' + author)">
          <k-icon name="user"></k-icon>{{ data.author.name }}
        </span>
        <span><k-icon name="balance"></k-icon>{{ data.license }}</span>
        <span><k-icon name="tag"></k-icon>{{ data.version }}</span>
        <span><k-icon name="file-archive"></k-icon>{{ Math.ceil(data.size / 1000) }} KB</span>
      </div>
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import { useRouter } from 'vue-router'
import { MarketProvider } from '@koishijs/plugin-manager'
import { store } from '@koishijs/client'
import { config, addFavorite, removeFavorite, getMixedMeta } from '../utils'

defineEmits(['query'])

const props = defineProps({
  data: {} as PropType<MarketProvider.Data>,
})

const meta = computed(() => getMixedMeta(props.data.name))

const repo = computed(() => {
  const { repository = '' } = props.data.links
  if (repository.startsWith('https://github.com')) {
    return 'github'
  }
})

const author = computed(() => props.data.author.username)

const router = useRouter()

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

  .k-badge {
    cursor: pointer;
    user-select: none;
  }

  header, footer {
    flex-shrink: 0;
  }

  header .k-icon {
    color: var(--fg1);
    margin-left: 0.5rem;
    height: 1.25rem;
    vertical-align: -3px;
    transition: color 0.3s ease;
  }

  .right {
    position: absolute;
    right: 1rem;
    top: -2px;
  }

  .info {
    cursor: default;
    font-size: 14px;
    color: var(--el-text-color-regular);
    transition: color 0.3s ease;

    .pointer {
      cursor: pointer;
    }

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
