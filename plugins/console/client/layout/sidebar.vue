<template>
  <aside class="layout-aside">
    <h1>Koishi 控制台</h1>
    <ul>
      <template v-for="({ name, path, meta }) in routes">
        <li v-if="!meta.hidden" :class="{ current: name === $route.name }">
          <router-link :to="path">
            <i :class="`fas fa-${meta.icon}`"/>
            {{ name }}
          </router-link>
        </li>
      </template>
    </ul>
  </aside>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const routes = computed(() => {
  return router.getRoutes().sort((a, b) => b.meta.order - a.meta.order)
})

</script>

<style lang="scss">

@import '../index.scss';

aside.layout-aside {
  position: fixed;
  height: 100%;
  width: var(--aside-width);
  background-color: var(--card-bg);
  box-shadow: var(--card-shadow);

  h1 {
    font-size: 1.5rem;
    text-align: center;
  }

  ul {
    list-style: none;
    width: 100%;
    padding-left: 0;
    margin: 0;
  }

  li {
    transition: 0.3s ease;
  }

  i {
    width: 1.5rem;
    margin-right: 0.5rem;
    text-align: center;
  }

  li a {
    display: block;
    font-size: 1.05rem;
    text-decoration: none;
    cursor: pointer;
    color: var(--fg1);
    line-height: 3rem;
    padding: 0 2rem;
    transition: 0.3s ease;
  }

  li:hover {
    background-color: var(--bg1);
    a {
      color: var(--fg0);
    }
  }

  li.current a {
    font-weight: bolder;
    color: var(--primary);
  }
}

</style>
