import { Context, icons, message, router, send, store } from '@koishijs/client'
import { config } from './utils'
import Login from './login.vue'
import Profile from './profile.vue'
import At from './icons/at.vue'
import Lock from './icons/lock.vue'
import SignIn from './icons/sign-in.vue'
import SignOut from './icons/sign-out.vue'
import UserFull from './icons/user-full.vue'

icons.register('at', At)
icons.register('lock', Lock)
icons.register('sign-in', SignIn)
icons.register('sign-out', SignOut)
icons.register('user-full', UserFull)

export default (ctx: Context) => {
  if (config.token && config.expire > Date.now()) {
    send('login/token', config.id, config.token).catch(e => message.error(e.message))
  }

  ctx.disposables.push(router.beforeEach((route) => {
    if ((route.meta.authority || route.meta.fields.includes('user')) && !store.user) {
      // handle router.back()
      return history.state.forward === '/login' ? '/' : '/login'
    }

    if (route.meta.authority && route.meta.authority > store.user.authority) {
      message.error('权限不足。')
      return false
    }
  }))

  ctx.addPage({
    path: '/login',
    name: '登录',
    icon: 'sign-in',
    position: () => store.user ? 'hidden' : 'bottom',
    component: Login,
  })

  ctx.addPage({
    path: '/profile',
    name: '用户资料',
    icon: 'user-full',
    fields: ['user'],
    position: () => store.user ? 'bottom' : 'hidden',
    component: Profile,
  })
}
