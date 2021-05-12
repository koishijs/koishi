<template>
  <k-card class="page-deps" :class="{ authorized: user?.authority >= 4 }" title="依赖管理">
    <table v-if="manager.packages.length">
      <tr>
        <th>模块名称</th>
        <th>当前版本</th>
        <th>最新版本</th>
        <th>综合评分</th>
        <th>操作</th>
      </tr>
      <dep-view v-for="remote in manager.packages" :remote="remote"/>
    </table>
    <p v-else>正在加载……</p>
  </k-card>
</template>

<script setup lang="ts">

import DepView from '../dependencies/dep-view.vue'
import { manager } from '../dependencies/manager'
import { user } from '~/client'

</script>
