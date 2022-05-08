<template>
  <k-card class="login">
    <template v-if="user">
      <h1><span>平台账户登录</span></h1>
      <p class="hint">欢迎你，{{ user.name || 'Koishi 用户' }}！</p>
      <p class="hint">请用上述账号将下面的验证码私聊发送给任意机器人</p>
      <p class="token">{{ user.token }}</p>
      <div class="control">
        <k-button @click="user.token = null">返回上一步</k-button>
      </div>
    </template>
    <template v-else>
      <h1 v-if="secure">
        <k-choose :data="['平台账户登录', '用户名密码登录']" v-model="config.authType"></k-choose>
      </h1>
      <h1 v-else><span>平台账户登录</span></h1>
      <template v-if="config.authType === 0">
        <el-input placeholder="平台名" v-model="config.platform" #prefix>
          <k-icon name="at"></k-icon>
        </el-input>
        <el-input placeholder="账号" v-model="config.userId" @keypress.enter.stop="loginWithAccount" #prefix>
          <k-icon name="user"></k-icon>
        </el-input>
        <p class="error" v-if="message">{{ message }}</p>
        <div class="control">
          <k-button @click="$router.back()">返回</k-button>
          <k-button @click="loginWithAccount">获取验证码</k-button>
        </div>
      </template>
      <template v-else>
        <el-input placeholder="用户名" v-model="config.name" #prefix>
          <k-icon name="user"></k-icon>
        </el-input>
        <el-input placeholder="密码" v-model="config.password" @keypress.enter.stop="loginWithPassword"
          :type="config.showPass ? 'text' : 'password'">
          <template #prefix><k-icon name="lock"></k-icon></template>
          <template #suffix>
            <k-icon :name="config.showPass ? 'eye' : 'eye-slash'" @click="config.showPass = !config.showPass"></k-icon>
          </template>
        </el-input>
        <p class="error" v-if="message">{{ message }}</p>
        <div class="control">
          <k-button @click="$router.back()">返回</k-button>
          <k-button @click="loginWithPassword">登录</k-button>
        </div>
      </template>
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { ref } from 'vue'
import { config, sha256 } from './utils'
import { send } from '@koishijs/client'
import { UserLogin } from '@koishijs/plugin-auth'

const secure = isSecureContext
if (!secure) config.authType = 0

const message = ref<string>()
const user = ref<UserLogin>()

let timestamp = 0
async function loginWithAccount() {
  const now = Date.now()
  if (now < timestamp) return
  const { platform, userId } = config
  if (!platform || !userId) return
  timestamp = now + 1000
  try {
    user.value = await send('login/platform', platform, userId)
  } catch (e) {
    message.value = e.message
  }
}

async function loginWithPassword() {
  const { name, password } = config
  try {
    await send('login/password', name, await sha256(password))
  } catch (e) {
    message.value = e.message
  }
}

</script>

<style lang="scss">

.route-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

section.login {
  width: 600px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  margin: 0;

  .k-card-body {
    padding: 3rem 0 !important;
  }

  h1 {
    font-size: 1.5rem;
    margin: 2.5rem auto;
    cursor: default;
  }

  .token {
    font-weight: bold;
  }

  .el-input {
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
