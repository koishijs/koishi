<template>
  <sidebar/>
  <main>
    <router-view v-if="loaded"/>
    <p v-else>正在加载数据……</p>
  </main>
  <component v-for="view in client.views" :is="view"/>
</template>

<script lang="ts" setup>

import * as client from '~/client'
import Sidebar from './sidebar.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loaded = computed(() => (route.meta.require || []).every((key) => client[key].value))

</script>

<style lang="scss">

@import '~/variables';

body {
  margin: 0;
  min-height: 100vh;
  font-family: PingFang SC, Hiragino Sans GB, Microsoft YaHei, SimSun, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--page-fg);
  background: var(--page-bg);
  position: relative;
}

a {
  color: $default;
  text-decoration: none;
}

main {
  margin-left: var(--aside-width);
  padding: 2rem 2rem 0;
}

::-webkit-scrollbar {
  height: 100%;
  width: 0.6rem;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  &:hover {
    background: var(--border-dark);
  }
}

::-webkit-scrollbar-track {
  border-radius: 0.6rem;
  background: var(--bg0);
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

table {
  text-align: center;
  width: 100%;
  border-collapse: collapse;

  tr {
    transition: 0.3s ease;
  }

  tr:not(:first-child):hover {
    background-color: var(--bg1);
  }

  td, th {
    padding: .5em 1em;
  }

  tr {
    border-top: 1px solid var(--border);
  }

  tr:last-child {
    border-bottom: 1px solid var(--border);
  }
}

</style>
