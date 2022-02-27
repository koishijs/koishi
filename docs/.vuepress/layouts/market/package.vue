<template>
  <div class="package-view">
    <div class="header">
      {{ data.shortname }}
      <!-- <a v-if="repo" :href="data.links.repository" target="_blank" rel="noopener noreferrer">
        <k-icon :name="repo"></k-icon>
      </a> -->
    </div>
    <p class="desc" v-html="data.description"></p>
    <div class="badges">
      <badge type="tip"
        v-if="data.official"
        @click="$emit('update:query', 'is:official')"
      >官方</badge>
      <badge type="primary"
        v-if="data.keywords.includes('impl:database')"
        @click="$emit('update:query', 'impl:database')"
      >数据库</badge>
      <badge type="primary"
        v-if="data.keywords.includes('impl:adapter')"
        @click="$emit('update:query', 'impl:adapter')"
      >适配器</badge>
      <badge type="primary"
        v-if="data.keywords.includes('impl:assets')"
        @click="$emit('update:query', 'impl:assets')"
      >资源存储</badge>
      <badge type="primary"
        v-if="data.keywords.includes('required:console') || data.keywords.includes('optional:console')"
        @click="$emit('update:query', 'using:console')"
      >控制台</badge>
    </div>
    <div class="footer">
      <div class="info">
        <span v-if="data.author" :class="{ pointer: email }" @click="email && $emit('query', 'email:' + email)">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
            <path fill="currentColor" d="M224 256c70.7 0 128-57.3 128-128S294.7 0 224 0 96 57.3 96 128s57.3 128 128 128zm89.6 32h-16.7c-22.2 10.2-46.9 16-72.9 16s-50.6-5.8-72.9-16h-16.7C60.2 288 0 348.2 0 422.4V464c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48v-41.6c0-74.2-60.2-134.4-134.4-134.4z"/>
          </svg>
          {{ data.author.name }}
        </span>
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
            <path fill="currentColor" d="M256 336h-.02c0-16.18 1.34-8.73-85.05-181.51-17.65-35.29-68.19-35.36-85.87 0C-2.06 328.75.02 320.33.02 336H0c0 44.18 57.31 80 128 80s128-35.82 128-80zM128 176l72 144H56l72-144zm511.98 160c0-16.18 1.34-8.73-85.05-181.51-17.65-35.29-68.19-35.36-85.87 0-87.12 174.26-85.04 165.84-85.04 181.51H384c0 44.18 57.31 80 128 80s128-35.82 128-80h-.02zM440 320l72-144 72 144H440zm88 128H352V153.25c23.51-10.29 41.16-31.48 46.39-57.25H528c8.84 0 16-7.16 16-16V48c0-8.84-7.16-16-16-16H383.64C369.04 12.68 346.09 0 320 0s-49.04 12.68-63.64 32H112c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h129.61c5.23 25.76 22.87 46.96 46.39 57.25V448H112c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h416c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16z"/>
          </svg>
          {{ data.license }}
        </span>
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <path fill="currentColor" d="M0 252.118V48C0 21.49 21.49 0 48 0h204.118a48 48 0 0 1 33.941 14.059l211.882 211.882c18.745 18.745 18.745 49.137 0 67.882L293.823 497.941c-18.745 18.745-49.137 18.745-67.882 0L14.059 286.059A48 48 0 0 1 0 252.118zM112 64c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48z"/>
          </svg>
          {{ data.version }}
        </span>
        <span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <path fill="currentColor" d="M377 105L279.1 7c-4.5-4.5-10.6-7-17-7H256v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zM128.4 336c-17.9 0-32.4 12.1-32.4 27 0 15 14.6 27 32.5 27s32.4-12.1 32.4-27-14.6-27-32.5-27zM224 136V0h-63.6v32h-32V0H24C10.7 0 0 10.7 0 24v464c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H248c-13.2 0-24-10.8-24-24zM95.9 32h32v32h-32zm32.3 384c-33.2 0-58-30.4-51.4-62.9L96.4 256v-32h32v-32h-32v-32h32v-32h-32V96h32V64h32v32h-32v32h32v32h-32v32h32v32h-32v32h22.1c5.7 0 10.7 4.1 11.8 9.7l17.3 87.7c6.4 32.4-18.4 62.6-51.4 62.6z"/>
          </svg>
          {{ Math.ceil(data.size / 1000) }} KB
        </span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import { computed, PropType } from 'vue'
import { AnalyzedPackage } from '@koishijs/pkg-utils'

defineEmits(['update:query'])

const props = defineProps({
  data: {} as PropType<AnalyzedPackage>,
})

const repo = computed(() => {
  const { repository = '' } = props.data.links
  if (repository.startsWith('https://github.com')) {
    return 'github'
  }
})

const email = computed(() => props.data.author?.email)

</script>

<style lang="scss">

.package-view {
  width: 100%;
  height: 12rem;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background-color: #1F1D26;
  border: 1px solid #4f515cbf;
  box-shadow: 0 6px 10px -4px rgb(0 0 0 / 15%);
  transition: color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease;

  > * {
    padding: 0 1.5rem;
  }

  .header {
    font-size: 1.3rem;
    font-weight: 500;
    margin: 1.25rem 0 1rem;
    flex-shrink: 0;
  }

  .footer {
    margin: 1.25rem 0;
    flex-shrink: 0;
  }

  .desc {
    margin: 0;
    font-size: 15px;
    flex-grow: 1;
  }

  .badges {
    flex-grow: 0.5;
  }

  .k-badge {
    cursor: pointer;
    user-select: none;
  }

  .info {
    cursor: default;
    font-size: 14px;
    color: var(--el-text-color-regular);
    transition: color 0.3s ease;

    .pointer {
      cursor: pointer;
    }

    svg {
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
