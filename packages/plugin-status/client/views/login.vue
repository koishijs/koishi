<template>
  <k-card class="login">
    <h1>
      <span :class="{ inactive: type === 1 }" @click="type = 0">平台账户登录</span>
      /
      <span :class="{ inactive: type === 0 }" @click="type = 1">用户名密码登录</span>
    </h1>
    <template v-if="token">
      <p class="hint">您的账号：{{ form2 }}</p>
      <p class="hint">请用上述账号将下面的验证码私聊发送给任意机器人</p>
      <p class="token">{{ token }}</p>
    </template>
    <template v-else>
      <k-input :prefix-icon="presets[type][0]" :placeholder="presets[type][1]" v-model="form1"/>
      <k-input :prefix-icon="presets[type][2]" :placeholder="presets[type][3]" v-model="form2"/>
      <div class="control">
        <k-button @click="$router.back()">返回</k-button>
        <k-button @click="validate">{{ presets[type][4] }}</k-button>
      </div>
    </template>
  </k-card>
</template>

<script lang="ts" setup>

import { ref } from 'vue'

const presets = [
  ['at', '平台名', 'user', '账号', '获取验证码'],
  ['user', '用户名', 'lock', '密码', '登录'],
]

const type = ref(0)
const token = ref('')
const form1 = ref('')
const form2 = ref('')

async function validate() {
  if (!form1.value || !form2.value) return
  try {
    const res = await fetch(`${KOISHI_ENDPOINT}/validate?platform=${form1.value}&userId=${form2.value}`, { mode: 'cors' })
    const data = await res.json()
    console.log(data)
    token.value = data.token
  } catch (err) {
    console.error(err)
  }
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
