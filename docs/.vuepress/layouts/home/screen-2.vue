<template>
  <div class="screen flex screen-2">
    <div class="feature-view">
      <div class="introduction">
        <h1>开箱即用</h1>
        <p>高度便利的控制台让你无需基础让你在几分钟之内搭建自己的聊天机器人。</p>
        <ul>
          <li>提供在线插件市场，一键下载安装插件</li>
          <li>支持 QQ，Telegram，Discord 等主流聊天平台</li>
          <li>随时随地通过控制面板监控运行状态，甚至上号聊天</li>
        </ul>
        <p>查看指南：<router-link to="/manual/starter/installation">创建 Koishi 模板项目</router-link></p>
      </div>
      <div class="image">
        <carousel></carousel>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>

import Carousel from './Carousel.vue'

defineEmits(['scroll-screen'])

</script>
