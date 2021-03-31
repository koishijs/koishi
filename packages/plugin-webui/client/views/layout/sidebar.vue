<template>
  <aside>
    <ul>
      <template v-for="({ name, path, meta }, index) in $router.getRoutes()" :key="index">
        <li v-if="isShown(meta)" :class="{ current: name === $route.name }">
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

import { user } from '~/client'
import type { RouteMeta } from 'vue-router'

function isShown(meta: RouteMeta) {
  if (meta.hidden) return false
  if (meta.authority && meta.authority > 1 && meta.authority > user.value?.authority) return false
  return true
}

</script>

<style lang="scss">

@import '../../index.scss';

aside {
  margin: 0 1rem;
  position: absolute;
  top: $navbarHeight;
  width: $sidebarWidth - 1rem;

  ul {
    list-style: none;
    width: 100%;
    padding-left: 0;
    margin: 0;
  }

  li {
    border-radius: 0.5rem;
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
    color: rgba(244, 244, 245, .6);
    line-height: 3rem;
    padding: 0 1rem;
    transition: 0.3s ease;
  }

  li:hover {
    background-color: rgba(4, 6, 32, .24);
    a {
      color: rgba(244, 244, 245, .8);
    }
  }

  li.current a {
    font-weight: bolder;
    color: rgba(244, 244, 245);
  }
}

</style>
