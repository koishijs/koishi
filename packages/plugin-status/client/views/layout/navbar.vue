<template>
  <nav>
    <span class="title">Koishi 控制台</span>
    <span class="right">
      <router-link to="/login">登录</router-link>
    </span>
  </nav>
</template>

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
