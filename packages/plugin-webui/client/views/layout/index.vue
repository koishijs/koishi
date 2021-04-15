<template>
  <template v-if="!frameless">
    <navbar/>
    <sidebar/>
  </template>
  <main :class="{ frameless }">
    <p v-if="invalid">权限不足。</p>
    <router-view v-else-if="loaded"/>
    <p v-else>正在加载数据……</p>
  </main>
  <component v-for="view in views" :is="view"/>
</template>

<script lang="ts" setup>

import * as client from '~/client'
import { views } from '~/client'
import Navbar from './navbar.vue'
import Sidebar from './sidebar.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const frameless = computed(() => route.meta.frameless)
const loaded = computed(() => (route.meta.require || []).every((key) => client[key].value))
const invalid = computed(() => route.meta.authority > client.user.value?.authority)

</script>

<style lang="scss">

@import '~/variables';

body {
  margin: 0;
  min-height: 100vh;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: rgba(244, 244, 245, .6);
  background: radial-gradient(farthest-side ellipse at 10% 0, #333867, #17193b);
  background-attachment: fixed;
  position: relative;
}

a {
  color: $default;
  text-decoration: none;
}

main {
  margin: $navbarHeight 0;
  padding: 0 $mainPadding;
  position: absolute;
  bottom: 0;
  top: 0;
  right: 0;
  left: $sidebarWidth;
}

main.frameless {
  margin: 0;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: fit-content;
}

::-webkit-scrollbar {
  height: 100%;
  width: 0.6rem;
}

::-webkit-scrollbar-thumb {
  border-radius: 0.6rem;
  background: #fff4;
  &:hover {
    background: #fff8;
  }
}

::-webkit-scrollbar-track {
  border-radius: 0.6rem;
  box-shadow: inset 0 0 6px #000b;
}

.card-grid {
  display: grid;
}

.card-grid .k-card {
  margin: 0;
}

.profile-grid {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: auto;
  grid-gap: 2rem;
  margin-bottom: 2rem;
}

.chart-grid {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, auto);
  grid-gap: 2rem;
  margin: 2rem 0 4rem;

  .echarts {
    max-width: 100%;
    margin: 0 auto;
  }

  @media (min-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, auto);

    @media (min-width: 1600px) {
      .echarts {
        width: 600px;
        height: 400px;
        max-width: 100%;
        margin: 0 auto;
      }
    }

    @media (max-width: 1600px) {
      .echarts {
        width: 480px;
        height: 360px;
      }
    }
  }

  @media (max-width: 1440px) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(4, auto);

    @media (min-width: 1200px) {
      .echarts {
        width: 800px;
        height: 400px;
      }
    }

    @media (max-width: 1200px) {
      .echarts {
        width: 720px;
        height: 400px;
      }
    }
  }
}

</style>
