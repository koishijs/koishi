<template>
  <parent-layout class="home">
    <template #navbar-after>
      <div class="icons">
        <a class="icon" href="https://discord.com/invite/xfxYwmd284" target="_blank" aria-label="Discord">
          <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 640 576"><path d="M524.531,69.836a1.5,1.5,0,0,0-.764-.7A485.065,485.065,0,0,0,404.081,32.03a1.816,1.816,0,0,0-1.923.91,337.461,337.461,0,0,0-14.9,30.6,447.848,447.848,0,0,0-134.426,0,309.541,309.541,0,0,0-15.135-30.6,1.89,1.89,0,0,0-1.924-.91A483.689,483.689,0,0,0,116.085,69.137a1.712,1.712,0,0,0-.788.676C39.068,183.651,18.186,294.69,28.43,404.354a2.016,2.016,0,0,0,.765,1.375A487.666,487.666,0,0,0,176.02,479.918a1.9,1.9,0,0,0,2.063-.676A348.2,348.2,0,0,0,208.12,430.4a1.86,1.86,0,0,0-1.019-2.588,321.173,321.173,0,0,1-45.868-21.853,1.885,1.885,0,0,1-.185-3.126c3.082-2.309,6.166-4.711,9.109-7.137a1.819,1.819,0,0,1,1.9-.256c96.229,43.917,200.41,43.917,295.5,0a1.812,1.812,0,0,1,1.924.233c2.944,2.426,6.027,4.851,9.132,7.16a1.884,1.884,0,0,1-.162,3.126,301.407,301.407,0,0,1-45.89,21.83,1.875,1.875,0,0,0-1,2.611,391.055,391.055,0,0,0,30.014,48.815,1.864,1.864,0,0,0,2.063.7A486.048,486.048,0,0,0,610.7,405.729a1.882,1.882,0,0,0,.765-1.352C623.729,277.594,590.933,167.465,524.531,69.836ZM222.491,337.58c-28.972,0-52.844-26.587-52.844-59.239S193.056,219.1,222.491,219.1c29.665,0,53.306,26.82,52.843,59.239C275.334,310.993,251.924,337.58,222.491,337.58Zm195.38,0c-28.971,0-52.843-26.587-52.843-59.239S388.437,219.1,417.871,219.1c29.667,0,53.307,26.82,52.844,59.239C470.715,310.993,447.538,337.58,417.871,337.58Z" fill="currentColor"/></svg>
        </a>
        <a class="icon" href="https://github.com/koishijs/koishi" target="_blank" aria-label="GitHub">
          <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><path d="M12 2C6.475 2 2 6.475 2 12a9.994 9.994 0 0 0 6.838 9.488c.5.087.687-.213.687-.476c0-.237-.013-1.024-.013-1.862c-2.512.463-3.162-.612-3.362-1.175c-.113-.288-.6-1.175-1.025-1.413c-.35-.187-.85-.65-.013-.662c.788-.013 1.35.725 1.538 1.025c.9 1.512 2.338 1.087 2.912.825c.088-.65.35-1.087.638-1.337c-2.225-.25-4.55-1.113-4.55-4.938c0-1.088.387-1.987 1.025-2.688c-.1-.25-.45-1.275.1-2.65c0 0 .837-.262 2.75 1.026a9.28 9.28 0 0 1 2.5-.338c.85 0 1.7.112 2.5.337c1.912-1.3 2.75-1.024 2.75-1.024c.55 1.375.2 2.4.1 2.65c.637.7 1.025 1.587 1.025 2.687c0 3.838-2.337 4.688-4.562 4.938c.362.312.675.912.675 1.85c0 1.337-.013 2.412-.013 2.75c0 .262.188.574.688.474A10.016 10.016 0 0 0 22 12c0-5.525-4.475-10-10-10z" fill="currentColor"></path></svg>
        </a>
        <a class="icon" @click="toggleDarkMode">
          <svg v-show="isDarkMode" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><path d="M11.38 2.019a7.5 7.5 0 1 0 10.6 10.6C21.662 17.854 17.316 22 12.001 22C6.477 22 2 17.523 2 12c0-5.315 4.146-9.661 9.38-9.981z" fill="currentColor"></path></svg>
          <svg v-show="!isDarkMode" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 24 24"><path d="M12 18a6 6 0 1 1 0-12a6 6 0 0 1 0 12zM11 1h2v3h-2V1zm0 19h2v3h-2v-3zM3.515 4.929l1.414-1.414L7.05 5.636L5.636 7.05L3.515 4.93zM16.95 18.364l1.414-1.414l2.121 2.121l-1.414 1.414l-2.121-2.121zm2.121-14.85l1.414 1.415l-2.121 2.121l-1.414-1.414l2.121-2.121zM5.636 16.95l1.414 1.414l-2.121 2.121l-1.414-1.414l2.121-2.121zM23 11v2h-3v-2h3zM4 11v2H1v-2h3z" fill="currentColor"></path></svg>
        </a>
      </div>
    </template>

    <template #page>
      <div class="homepage">
        <div class="screen flex screen-1">
          <h1><span class="koi">Koi</span>shi.js</h1>
          <p class="desc">CROSS-PLATFORM CHATBOT FRAMEWORK MADE WITH <span class="koi">LOVE</span></p>
          <svg aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" class="w-10 h-10">
            <g>
              <path fill="var(--c-love)" d="M160 256.14l-56.51 56.47-96.44-96.15a23.77 23.77.0 01-.18-33.61l.18-.18 22.59-22.51a23.94 23.94.0 0133.85.0z"></path>
              <path fill="currentcolor" d="M313 182.57 290.21 160a23.94 23.94.0 00-33.85.0L103.47 312.61 143 352l.06.06a24 24 0 0033.93-.16L313 216.36l.18-.17a23.78 23.78.0 00-.18-33.62z"></path>
            </g>
          </svg>
        </div>

        <div class="screen flex screen-2">
          <div class="feature-view">
            <div class="introduction">
              <h1>开箱即用</h1>
              <p>高度便利的控制台让你无需基础让你在几分钟之内搭建自己的聊天机器人。</p>
              <ul>
                <li>提供在线插件市场，一键下载安装插件</li>
                <li>支持 QQ，Telegram，Discord 等主流聊天平台</li>
                <li>随时随机通过控制面板监控运行状态，甚至上号聊天</li>
              </ul>
              <p>查看指南：<router-link to="/guide/basic/console">创建 Koishi 控制台项目</router-link></p>
            </div>
            <div class="image">此处应该有一张图</div>
          </div>
        </div>

        <div class="screen flex screen-3">
          <div class="feature-view">
            <div class="introduction">
              <h1>功能强大</h1>
              <p>中间件，指令系统，插件系统，数据库，跨平台……它们可以让你顺利实现任何需求。</p>
            </div>
            <div class="image">此处应该有一张图</div>
          </div>
        </div>

        <div class="screen flex screen-4">
          <div class="introduction center">
            <h1>生态丰富</h1>
            <p>官方提供了大量插件和解决方案，覆盖了绝大多数常见需求的同时，也为开发提供了绝佳的范例。</p>
          </div>
        </div>

        <div class="screen flex screen-5">
          <div class="introduction center">
            <h1>专为开发者打造</h1>
            <p>不知道这里应该说什么，总之先编一段话。</p>
          </div>
          <div class="advantages">
            <div class="advantage">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path d="M0 512v512h1024V0H0z m825.216-40.789333c26.026667 6.485333 45.824 18.048 64.042667 36.906666 9.429333 10.069333 23.424 28.416 24.533333 32.853334 0.341333 1.28-44.202667 31.146667-71.168 47.914666-0.981333 0.64-4.906667-3.584-9.258667-10.069333-13.226667-19.2-27.008-27.477333-48.128-28.928-31.061333-2.133333-51.029333 14.122667-50.858666 41.258667a37.546667 37.546667 0 0 0 4.352 19.2c6.826667 14.122667 19.541333 22.613333 59.306666 39.808 73.344 31.573333 104.704 52.352 124.202667 81.92 21.76 32.981333 26.666667 85.674667 11.861333 124.842666-16.213333 42.581333-56.533333 71.509333-113.28 81.066667-17.536 3.114667-59.136 2.645333-77.994666-0.768-41.130667-7.338667-80.128-27.648-104.192-54.314667-9.429333-10.368-27.818667-37.546667-26.666667-39.466666a67.413333 67.413333 0 0 1 9.386667-6.016c4.608-2.602667 21.802667-12.544 38.058666-21.973334l29.44-17.066666 6.186667 9.130666c8.618667 13.141333 27.434667 31.189333 38.826667 37.205334 32.682667 17.237333 77.525333 14.805333 99.626666-5.034667a37.674667 37.674667 0 0 0 13.354667-30.72c0-11.861333-1.493333-17.066667-7.68-26.026667-7.936-11.349333-24.192-20.906667-70.357333-40.96-52.821333-22.741333-75.562667-36.864-96.384-59.306666a135.04 135.04 0 0 1-28.117334-51.2c-3.882667-14.464-4.864-50.730667-1.792-65.322667 10.88-51.072 49.408-86.613333 105.002667-97.194667 18.048-3.413333 59.989333-2.133333 77.696 2.261334z m-240.384 42.752l0.341333 41.941333H451.84v378.709333H357.546667v-378.709333H224.341333v-41.130667c0-22.784 0.469333-41.813333 1.109334-42.24 0.512-0.682667 81.621333-1.024 179.925333-0.853333l178.986667 0.512z" fill="currentcolor"></path></svg>
              <h2>类型支持</h2>
              <p>Koishi 完全基于 TypeScript 开发，拥有顶级的类型支持，丰富的代码提示让你在编写代码的时候甚至无需查看文档。</p>
              <p><router-link to="/">了解更多</router-link></p>
            </div>
            <div class="advantage">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M437.2 403.5L320 215V64h8c13.3 0 24-10.7 24-24V24c0-13.3-10.7-24-24-24H120c-13.3 0-24 10.7-24 24v16c0 13.3 10.7 24 24 24h8v151L10.8 403.5C-18.5 450.6 15.3 512 70.9 512h306.2c55.7 0 89.4-61.5 60.1-108.5zM137.9 320l48.2-77.6c3.7-5.2 5.8-11.6 5.8-18.4V64h64v160c0 6.9 2.2 13.2 5.8 18.4l48.2 77.6h-172z" fill="currentcolor"/></svg>
              <h2>单元测试</h2>
              <p>所有核心功能均已经通过单元测试，既确保了可靠性，也为开发者提供了一套测试插件和定位问题的最佳实践。</p>
              <p><router-link to="/">了解更多</router-link></p>
            </div>
            <div class="advantage">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path d="M519.442 288.651c-41.519 0-59.5 31.593-82.058 31.593C377.409 320.244 432 144 432 144s-196.288 80-196.288-3.297c0-35.827 36.288-46.25 36.288-85.985C272 19.216 243.885 0 210.539 0c-34.654 0-66.366 18.891-66.366 56.346 0 41.364 31.711 59.277 31.711 81.75C175.885 207.719 0 166.758 0 166.758v333.237s178.635 41.047 178.635-28.662c0-22.473-40-40.107-40-81.471 0-37.456 29.25-56.346 63.577-56.346 33.673 0 61.788 19.216 61.788 54.717 0 39.735-36.288 50.158-36.288 85.985 0 60.803 129.675 25.73 181.23 25.73 0 0-34.725-120.101 25.827-120.101 35.962 0 46.423 36.152 86.308 36.152C556.712 416 576 387.99 576 354.443c0-34.199-18.962-65.792-56.558-65.792z" fill="currentcolor"/></svg>
              <h2>模块热重载</h2>
              <p>开发 Koishi 插件时，只需轻点保存即可热重载，无需频繁重启机器人，如同前端开发一样丝滑顺畅。</p>
              <p><router-link to="/">了解更多</router-link></p>
            </div>
          </div>
        </div>

        <div class="screen screen-6">
          <div class="navigation">
            <div v-for="item in getSidebarItems('/guide/')" :key="item.link || item.text">
              <sidebar-child :item="item"></sidebar-child>
            </div>
            <div v-for="item in getSidebarItems('/api/')" :key="item.link || item.text">
              <sidebar-child :item="item"></sidebar-child>
            </div>
          </div>
          <footer>
            MIT Licensed | Copyright © 2019-2022 Shigma
          </footer>
        </div>
      </div>
    </template>
  </parent-layout>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import ParentLayout from '@vuepress/theme-default/lib/client/layouts/Layout.vue'
import { SidebarChild } from '@vuepress/theme-default/lib/client/components/SidebarChild'
import { useDarkMode, useThemeLocaleData, resolveArraySidebarItems } from '@vuepress/theme-default/lib/client/composables'

function getSidebarItems(route: string) {
  const config = useThemeLocaleData().value
  return resolveArraySidebarItems(config.sidebar[route].filter(item => item.isGroup), 1)
}

const isDarkMode = useDarkMode()
const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
}

</script>

<style lang="scss">

.home .navbar .icons {
  margin: 0 0.5rem 0 1.5rem;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;

  a.icon {
    width: 1.25rem;
    height: 1.25rem;
    line-height: 2rem;
    color: var(--c-fg4);
    cursor: pointer;
    transition: .3s ease;
    user-select: none;

    &:hover {
      color: var(--c-text);
    }
  }
}

.homepage {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  display: grid;
  grid-template-rows: repeat(5, 100vh);

  .desc {
    color: var(--c-fg4);
    text-transform: uppercase;
  }

  .koi {
    color: var(--c-love);
  }

  .screen.flex {
    padding: 6rem;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .introduction.center {
    text-align: center;
  }

  h1 {
    margin: 0;
    font-weight: 400;
  }

  h2 {
    font-weight: 400;
  }
}

.screen-1 {
  h1 {
    font-size: 3rem;
  }

  svg {
    position: absolute;
    opacity: 60%;
    bottom: 1.5rem;
    width: 1.5rem;
    animation: bounce 1s infinite;
  }
}

.feature-view {
  max-width: 80rem;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;
  justify-items: center;
}

.advantages {
  max-width: 60rem;
  transition: border-color var(--t-color);
  margin: 6rem 0 2rem;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  align-content: stretch;
  justify-content: space-between;

  .advantage {
    text-align: center;
    flex-grow: 1;
    flex-basis: 30%;
    max-width: 30%;

    h2 {
      padding: 0;
      margin: 1rem;
      border-bottom: none;
    }

    svg {
      height: 2rem;
    }
  }
}

.screen-6 {
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--navbar-height));

  footer {
    flex-shrink: 0;
    padding: 2.5rem;
    text-align: center;
  }
}

.navigation {
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  gap: 1rem;
  height: calc(100% - 10rem);
  border-bottom: 1px solid var(--c-border);
  border-top: 1px solid var(--c-border);
  background-color: var(--c-bg-light);
  padding: 2rem 6rem;
  transition: border-color var(--t-color);

  ul {
    padding: 0;
    margin: 0;
    list-style-type: none;
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(-50%);
    animation-timing-function: cubic-bezier(.8, 0, 1, 1);
  }

  50% {
    transform: none;
    animation-timing-function: cubic-bezier(0, 0, .2, 1);
  }
}

</style>
