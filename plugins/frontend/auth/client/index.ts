import { Context } from '~/client'
import { Icons } from '~/components'
import { user } from './utils'
import Login from './login.vue'
import Profile from './profile.vue'
import SignIn from './icons/sign-in.vue'
import SignOut from './icons/sign-out.vue'
import UserFull from './icons/user-full.vue'

Icons.register('sign-in', SignIn)
Icons.register('sign-out', SignOut)
Icons.register('user-full', UserFull)

export default (ctx: Context) => {
  ctx.addPage({
    path: '/login',
    name: '登录',
    icon: 'sign-in',
    position: () => user.value ? 'hidden' : 'bottom',
    component: Login,
  })

  ctx.addPage({
    path: '/profile',
    name: '用户资料',
    icon: 'user-full',
    position: () => user.value ? 'bottom' : 'hidden',
    component: Profile,
  })
}
