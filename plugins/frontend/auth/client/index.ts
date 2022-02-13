import { Context, router, send, store } from '~/client'
import { Icons, message } from '~/components'
import { config } from './utils'
import Login from './login.vue'
import Profile from './profile.vue'
import SignIn from './icons/sign-in.vue'
import SignOut from './icons/sign-out.vue'
import UserFull from './icons/user-full.vue'

Icons.register('sign-in', SignIn)
Icons.register('sign-out', SignOut)
Icons.register('user-full', UserFull)

export default (ctx: Context) => {
  if (config.token && config.expire > Date.now()) {
    send('login/token', config.id, config.token).catch(e => message.error(e.message))
  }

  ctx.disposables.push(router.beforeEach((route) => {
    // handle router.back()
    if ((route.meta.authority || route.meta.fields.includes('user')) && !store.user) {
      return history.state.forward === '/login' ? '/' : '/login'
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
