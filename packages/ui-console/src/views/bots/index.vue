<template>
  <k-card class="page-bots frameless">
    <div class="bot-table" v-if="profile.bots.length">
      <div class="add" :class="{ active: current === -1 }" @click="current = -1">添加机器人</div>
      <div class="bots">
        <bot-view
            v-for="(bot, index) in profile.bots" :data="bot"
            :class="{ active: current === index }" @click="current = index"/>
      </div>
    </div>
    <template v-if="current === null">
      <el-empty v-if="profile.bots.length" description="当前未选择机器人"></el-empty>
      <el-empty v-else description="当前没有配置任何机器人">
        <k-button solid>添加机器人</k-button>
      </el-empty>
    </template>
    <el-scrollbar v-else class="bot-profile">
      <div class="content">
        <add-bot v-if="current === -1"></add-bot>
      </div>
    </el-scrollbar>
  </k-card>
</template>

<script setup lang="ts">

import { ref } from 'vue'
import { ElEmpty } from 'element-plus'
import { profile } from '~/client'
import AddBot from './add.vue'
import BotView from './bot.vue'

const current = ref<number>(null)

</script>

<style lang="scss">

@import '~/variables';

section.page-bots {
  height: calc(100vh - 4rem);

  > div.k-card-body {
    height: 100%;
    display: grid;
    grid-template-columns: 20rem 1fr;
  }

  div.bot-table {
    overflow-y: auto;
    border-right: 1px solid var(--border);

    .add {
      font-size: 1.15rem;
      text-align: center;
      padding: 1rem 0;
      font-weight: bold;
      border-bottom: 1px solid var(--border);
      @include button-like;
    }
  }

  div.bot-profile {
    .el-empty {
      height: 100%;
    }

    .content {
      margin: auto;
      max-width: 50rem;
      padding: 3rem 3rem 1rem;
    }
  }
}

</style>
