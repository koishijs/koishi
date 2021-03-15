<template>
  <nav>
    <h1>Koishi 控制台</h1>
  </nav>
  <aside>
    <ul>
      <li v-for="(route, index) in $router.getRoutes()" :key="index" :class="{ current: route.name === $route.name }">
        <router-link :to="route.path">
          <i :class="['fas', `fa-${route.meta.icon}`]"/>
          {{ route.name }}
        </router-link>
      </li>
    </ul>
  </aside>
  <main><slot/></main>
</template>

<script lang="ts" setup>
</script>

<style lang="scss">

body {
  margin: 0;
  font-size: 14px;
  min-height: 100vh;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: rgba(244, 244, 245, .6);
  overflow-x: hidden;
  background: radial-gradient(farthest-side ellipse at 10% 0, #333867, #17193b);
  position: relative;
}

$navbarHeight: 4rem;
$sidebarWidth: 20rem;

nav {
  padding: 1rem 2rem;
  line-height: 2rem;

  h1 {
    margin: 0;
    font-size: 1.25rem;
    color: rgba(244, 244, 245, .8);
  }
}

main {
  margin-left: $sidebarWidth;
}

aside {
  margin: 0 1rem;
  position: absolute;
  top: $navbarHeight;
  width: $sidebarWidth - 2rem;

  ul {
    list-style: none;
    width: 100%;
    padding-left: 0;
  }

  li {
    border-radius: 0.5rem;
    transition: 0.3s ease;
  }

  i {
    width: 1rem;
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
