<template>
  <k-card class="market-view">
    <template #header>
      {{ data.shortname }}
      <a v-if="data.links.homepage" :href="data.links.homepage" target="_blank" rel="noopener noreferrer">
        <k-icon name="link"></k-icon>
      </a>
      <k-button v-if="store.packages[data.name]" solid type="success" class="right" @click="gotoSettings(data.shortname)">配置</k-button>
      <k-button v-else-if="!config.override[data.name]" solid class="right" @click="addFavorite(data.name)">添加</k-button>
      <k-button v-else solid type="warning" class="right" @click="removeFavorite(data.name)">取消</k-button>
    </template>
    <k-markdown inline class="desc" :source="meta.manifest.description.zh || meta.manifest.description.en"></k-markdown>
    <div class="badges">
      <k-badge type="success"
        v-if="data.official"
        @click="$emit('query', 'is:official')"
      >官方</k-badge>
      <k-badge type="primary"
        v-if="meta.manifest.service.implements.includes('database')"
        @click="$emit('query', 'impl:database')"
      >数据库</k-badge>
      <k-badge type="primary"
        v-if="meta.manifest.service.implements.includes('adapter')"
        @click="$emit('query', 'impl:adapter')"
      >适配器</k-badge>
      <k-badge type="primary"
        v-if="meta.manifest.service.implements.includes('manifestassets')"
        @click="$emit('query', 'impl:assets')"
      >资源存储</k-badge>
      <k-badge type="primary"
        v-if="meta.manifest.service.required.includes('console') || meta.manifest.service.optional.includes('console')"
        @click="$emit('query', 'using:console')"
      >控制台</k-badge>
    </div>
    <template #footer>
      <div class="info">
        <span v-if="data.author" :class="{ pointer: email }" @click="email && $emit('query', 'email:' + email)">
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
import { MarketProvider } from '@koishijs/plugin-manager'
import { store } from '@koishijs/client'
import { config, addFavorite, removeFavorite, getMixedMeta, gotoSettings } from '../utils'

defineEmits(['query'])

const props = defineProps({
  data: {} as PropType<MarketProvider.Data>,
})

const meta = computed(() => getMixedMeta(props.data.name))

const email = computed(() => props.data.author?.email)

</script>

<style lang="scss">

.market-view {
  width: 100%;
  height: 192px;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  header, footer {
    margin: 1rem 0;
  }

  .k-card-body {
    margin: -1rem 0;
    flex-grow: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
  }

  .desc {
    margin: 0;
    font-size: 15px;
  }

  header, footer {
    flex-shrink: 0;
  }

  header .k-icon {
    color: var(--fg1);
    margin-left: 0.6rem;
    height: 1rem;
    vertical-align: -1px;
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
