<template>
  <k-card class="page-plugins" :class="{ authorized: user?.authority >= 4 }">
    <template #header>
      <span :class="{ inactive: config.pluginTab === 1 }" @click="config.pluginTab = 0">插件列表</span>
      /
      <span :class="{ inactive: config.pluginTab === 0 }" @click="config.pluginTab = 1">依赖管理</span>
    </template>
    <template v-if="config.pluginTab === 0">
      <div class="table-header plugin-item">
        <span class="title">插件名</span>
        <span class="complexity">复杂度</span>
        <span class="operation">操作</span>
      </div>
      <div class="plugin-list root">
        <plugin-view :data="data" v-for="(data) in registry.plugins"/>
      </div>
    </template>
    <table v-else-if="manager.packages.length">
      <tr>
        <th>模块名称</th>
        <th>当前版本</th>
        <th>最新版本</th>
        <th>综合评分</th>
      </tr>
      <dep-view v-for="remote in manager.packages" :remote="remote"/>
    </table>
    <p v-else>正在加载……</p>
  </k-card>
</template>

<script setup lang="ts">

import PluginView from './plugin-view.vue'
import DepView from './dep-view.vue'
import { manager } from './manager'
import { registry, user, config } from '~/client'

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

.package-name {
  text-align: left;

  a {
    font-weight: bold;
    transition: 0.3s ease;
    color: rgba(244, 244, 245, 0.6);
  }
  a:hover {
    color: rgba(244, 244, 245);
  }
}

</style>
