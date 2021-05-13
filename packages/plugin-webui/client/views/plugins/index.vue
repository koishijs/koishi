<template>
  <k-card class="page-plugins" :class="{ authorized: user?.authority >= 4 }" title="插件列表">
    <div class="table-header plugin-item">
      <span class="title">插件名</span>
      <span class="complexity">复杂度</span>
      <span class="operation">操作</span>
    </div>
    <div class="plugin-list root">
      <plugin-view :data="data" v-for="(data) in registry.plugins"/>
    </div>
  </k-card>
</template>

<script setup lang="ts">

import PluginView from './plugin-view.vue'
import { registry, user } from '~/client'

</script>

<style lang="scss">

@import '~/variables';

.page-plugins {
  header {
    color: rgba(244, 244, 245, .6);

    span {
      transition: 0.3s ease;
    }

    span.inactive:hover {
      cursor: pointer;
      color: rgba(244, 244, 245, .8);
    }

    span:not(.inactive) {
      color: rgba(244, 244, 245);
    }
  }
}

.table-header {
  font-weight: bold;
  border-top: $borderColor 1px solid;

  .title {
    margin-left: 3rem;
  }
}

.page-plugins:not(.authorized) {
  .complexity, .operation {
    display: none;
  }
}

</style>
