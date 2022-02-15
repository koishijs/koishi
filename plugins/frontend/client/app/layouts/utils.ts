import { reactive } from 'vue'
import { RouteRecordName } from 'vue-router'
import { router } from '@koishijs/client'

export const routeCache = reactive<Record<RouteRecordName, string>>({})

router.afterEach(() => {
  const { name, fullPath } = router.currentRoute.value
  routeCache[name] = fullPath
})
