<template>
  <div class="package-view">
    <div class="header">
      <a class="left" :href="data.links.npm" target="_blank" rel="noopener noreferrer">{{ data.shortname }}</a>
      <a class="right" v-if="data.links.homepage" :href="data.links.homepage" target="_blank" rel="noopener noreferrer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
          <path fill="currentColor" d="M326.612 185.391c59.747 59.809 58.927 155.698.36 214.59-.11.12-.24.25-.36.37l-67.2 67.2c-59.27 59.27-155.699 59.262-214.96 0-59.27-59.26-59.27-155.7 0-214.96l37.106-37.106c9.84-9.84 26.786-3.3 27.294 10.606.648 17.722 3.826 35.527 9.69 52.721 1.986 5.822.567 12.262-3.783 16.612l-13.087 13.087c-28.026 28.026-28.905 73.66-1.155 101.96 28.024 28.579 74.086 28.749 102.325.51l67.2-67.19c28.191-28.191 28.073-73.757 0-101.83-3.701-3.694-7.429-6.564-10.341-8.569a16.037 16.037 0 0 1-6.947-12.606c-.396-10.567 3.348-21.456 11.698-29.806l21.054-21.055c5.521-5.521 14.182-6.199 20.584-1.731a152.482 152.482 0 0 1 20.522 17.197zM467.547 44.449c-59.261-59.262-155.69-59.27-214.96 0l-67.2 67.2c-.12.12-.25.25-.36.37-58.566 58.892-59.387 154.781.36 214.59a152.454 152.454 0 0 0 20.521 17.196c6.402 4.468 15.064 3.789 20.584-1.731l21.054-21.055c8.35-8.35 12.094-19.239 11.698-29.806a16.037 16.037 0 0 0-6.947-12.606c-2.912-2.005-6.64-4.875-10.341-8.569-28.073-28.073-28.191-73.639 0-101.83l67.2-67.19c28.239-28.239 74.3-28.069 102.325.51 27.75 28.3 26.872 73.934-1.155 101.96l-13.087 13.087c-4.35 4.35-5.769 10.79-3.783 16.612 5.864 17.194 9.042 34.999 9.69 52.721.509 13.906 17.454 20.446 27.294 10.606l37.106-37.106c59.271-59.259 59.271-155.699.001-214.959z"/>
        </svg>
      </a>
    </div>
    <p class="desc" v-html="data.description"></p>
    <div class="badge-container">
      <badge type="tip"
        v-if="data.official"
        @click="$emit('query', 'is:official')"
      >官方</badge>
      <badge type="primary"
        v-if="data.keywords.includes('impl:database')"
        @click="$emit('query', 'impl:database')"
      >数据库</badge>
      <badge type="primary"
        v-if="data.keywords.includes('impl:adapter')"
        @click="$emit('query', 'impl:adapter')"
      >适配器</badge>
      <badge type="primary"
        v-if="data.keywords.includes('impl:assets')"
        @click="$emit('query', 'impl:assets')"
      >资源存储</badge>
      <badge type="primary"
        v-if="data.keywords.includes('required:console') || data.keywords.includes('optional:console')"
        @click="$emit('query', 'using:console')"
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

defineEmits(['query'])

const props = defineProps({
  data: {} as PropType<AnalyzedPackage>,
})

const email = computed(() => props.data.author?.email)

</script>

<style lang="scss">

.package-view {
  width: 100%;
  height: 12rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  > * {
    padding: 0 1.5rem;
  }

  .header {
    font-size: 1.3rem;
    font-weight: 500;
    margin: 1.25rem 0 1rem;
    flex-shrink: 0;

    .right {
      float: right;
    }

    a {
      color: inherit;
    }

    svg {
      height: 1rem;
    }
  }

  .footer {
    margin: 1.25rem 0;
    flex-shrink: 0;
  }

  .desc {
    margin: 0;
    font-size: 15px;
    flex-grow: 3;
  }

  .badge-container {
    flex-grow: 1;
  }

  .badge {
    cursor: pointer;
  }

  .badge.primary {
    background-color: var(--c-primary);
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
      margin-right: 6px;
      vertical-align: -1px;
    }

    span + span {
      margin-left: 1.5rem;
    }
  }
}

</style>
