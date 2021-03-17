<template>
  <nav>
    <span class="title">Koishi 控制台</span>
    <span class="right">
      <router-link v-if="user" to="/profile">{{ user.name }}</router-link>
      <router-link v-else to="/login">登录</router-link>
    </span>
  </nav>
</template>

<script lang="ts" setup>

import { user } from '~/client'

</script>

<style lang="scss">

nav {
  padding: 1rem 2rem;
  line-height: 2rem;

  .title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: bold;
    color: rgba(244, 244, 245, .8);
  }

  .right {
    font-size: 1.05rem;
    float: right;
  }
}

</style>
