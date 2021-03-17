<template>
  <k-card class="login">
    <h1>
      <span :class="{ inactive: config.authType === 1 }" @click="config.authType = 0">平台账户登录</span>
      /
      <span :class="{ inactive: config.authType === 0 }" @click="config.authType = 1">用户名密码登录</span>
    </h1>
    <template v-if="data.token">
      <p class="hint">欢迎你，{{ data.name || 'Koishi 用户' }}！</p>
      <p class="hint">请用上述账号将下面的验证码私聊发送给任意机器人：</p>
      <p class="token">{{ data.token }}</p>
    </template>
    <template v-else-if="config.authType === 0">
      <k-input prefix="at" placeholder="平台名" v-model="config.platform"/>
      <k-input prefix="user" placeholder="账号" v-model="config.userId" @enter="enter"/>
      <p class="error" v-if="data.message">{{ data.message }}</p>
      <div class="control">
        <k-button @click="$router.back()">返回</k-button>
        <k-button @click="enter">获取验证码</k-button>
      </div>
    </template>
    <template v-else>
      <k-input prefix="user" placeholder="用户名" v-model="config.username"/>
      <k-input prefix="lock" placeholder="密码" v-model="config.password" type="password" @enter="enter"/>
      <p class="error" v-if="data.message">{{ data.message }}</p>
      <div class="control">
        <k-button @click="$router.back()">返回</k-button>
        <k-button @click="login">登录</k-button>
      </div>
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { send, receive, user, config, sha256 } from '~/client'

interface LoginData {
  token?: string
  name?: string
  message?: string
}

const data = ref<LoginData>({})
const router = useRouter()

receive('login', body => data.value = body)

watch(user, (value) => {
  if (!value) return
  router.push('/profile')
})

let timestamp = 0

async function enter() {
  const now = Date.now()
  if (now < timestamp) return
  const { platform, userId } = config.value
  if (!platform || !userId) return
  timestamp = now + 1000
  send('token', { platform, userId })
}

async function login() {
  const { username, password } = config.value
  send('login', { username, password: await sha256(password) })
}

</script>

<style lang="scss">

section.login {
  font-size: 16px;
  max-width: 600px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;

  .k-card-body {
    padding: 3rem 0 !important;
  }

  h1 {
    font-size: 1.5rem;
    margin: 2.5rem auto;
    cursor: default;

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

  .k-input {
    display: block;
    max-width: 400px;
    margin: 1rem auto;
  }

  .control {
    margin: 2.5rem auto;
  }

  .k-button {
    width: 8rem;
    margin: 0 1rem;
  }
}

</style>
