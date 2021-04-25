<template>
  <nav>
    <span class="title">{{ title }}</span>
    <span class="right">
      <template v-if="user">
        <router-link to="/profile">{{ user.name }}<i class="fas fa-user-circle"/></router-link>
        <k-button frameless @click="logout">登出<i class="fas fa-sign-out-alt"/></k-button>
      </template>
      <template v-else>
        <router-link to="/login">登录<i class="fas fa-sign-in-alt"/></router-link>
      </template>
    </span>
  </nav>
</template>

<script lang="ts" setup>

import { user } from '~/client'
import { useRouter } from 'vue-router'

const { title } = KOISHI_CONFIG

const router = useRouter()

async function logout() {
  await router.push('/login')
  user.value = null
}

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

    i {
      margin-left: 0.4rem;
    }

    > * + * {
      margin-left: 1rem;
    }
  }
}

</style>
