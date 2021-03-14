<template>
  <main class="layout">
    <slot/>
  </main>
</template>

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

</style>
