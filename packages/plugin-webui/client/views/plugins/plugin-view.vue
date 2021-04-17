<template>
  <div class="plugin-view">
    <div class="plugin-item">
      <span :class="['title', { 'has-children': data.children.length }]" @click="data.children.length && (show = !show)">
        <i class="fas fa-angle-right" :class="{ show }"/>
        {{ data.name }}
        <k-badge type="default" v-if="data.webExtension" title="拥有网页扩展的插件停用和启用后将刷新页面。">网页扩展</k-badge>
        <k-badge type="warn" v-if="data.sideEffect" title="拥有副作用的插件无法被停用。">副作用</k-badge>
      </span>
      <span class="complexity">{{ data.complexity || '-' }}</span>
      <span class="operation">
        <k-button class="right" frameless :type="data.name === 'webui' ? 'danger' : ''"
          :disabled="data.sideEffect" @click="toggle(data.id)"
        >{{ data.complexity ? '停用' : '启用' }}</k-button>
      </span>
    </div>
    <k-collapse v-if="data.children.length">
      <div class="plugin-list" v-show="show">
        <plugin-view :data="data" v-for="(data, index) in data.children" :key="index" />
      </div>
    </k-collapse>
  </div>
</template>

<script setup lang="ts">

import type { Registry } from '~/server'
import { send, user } from '~/client'
import { ref, defineProps } from 'vue'
import PluginView from './plugin-view.vue'

const show = ref(false)

defineProps<{ data: Registry.PluginData }>()

function toggle(plugin: string) {
  const { id, token } = user.value
  send('switch', { plugin, id, token })
}

</script>

<style lang="scss">

@import '~/variables';

:not(.has-children) > .fa-angle-right {
  font-size: 1.25rem !important;

  &::before {
    content: "•";
  }
}

.fa-angle-right {
  margin-left: 0.75rem;
  margin-right: 0.5rem;
  transition: 0.3s ease;
  font-size: 1.25rem !important;
  width: 1.5rem;
  text-align: center;
  vertical-align: middle !important;
}

.fa-angle-right.show {
  transform: rotate(90deg);
}

.plugin-item {
  line-height: 1.6;
  user-select: none;
  padding: 0.5rem 0;
  border-bottom: $borderColor 1px solid;

  .title {
    font-weight: bold;
  }

  .title.has-children {
    cursor: pointer;
  }

  &.normal {
    color: $default;
  }

  &.side-effect {
    color: $error;
  }

  &:hover {
    background-color: #474d8450;
  }

  .complexity {
    position: absolute;
    left: 45%;
    width: 10%;
    text-align: center;
  }

  .operation {
    float: right;
    margin-right: 3rem;
  }
}

.plugin-view .plugin-list {
  padding-left: 2rem;
}

</style>
