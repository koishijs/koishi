import { defineAsyncComponent, h, resolveComponent } from 'vue'
import { Console } from '@koishijs/plugin-console'
import { Card, Store, store } from '@koishijs/client'
import type * as echarts from 'echarts'

const VChart = defineAsyncComponent(() => import('./echarts'))

export interface ChartOptions {
  title: string
  fields?: (keyof Console.Services)[]
  options: (store: Store) => echarts.EChartsOption
}

export function createChart({ title, fields, options }: ChartOptions) {
  return Card.create(() => {
    const option = options(store)
    if (!option) return
    return h(resolveComponent('k-card'), { class: 'frameless', title }, () => {
      return h(VChart, { option, autoresize: true })
    })
  }, fields)
}

interface CommonData {
  name: string
  value: number
}

export namespace Tooltip {
  type FormatterCallback<T> = (params: T) => string
  type FormatterCallbackParams<T> = Omit<echarts.DefaultLabelFormatterCallbackParams, 'data'> & { data: T }

  export const item = <T = CommonData>(formatter: FormatterCallback<FormatterCallbackParams<T>>) => ({
    trigger: 'item',
    formatter,
  } as echarts.TooltipComponentOption)

  export const axis = <T = CommonData>(formatter: FormatterCallback<FormatterCallbackParams<T>[]>) => ({
    trigger: 'axis',
    axisPointer: {
      type: 'cross',
    },
    formatter,
  } as echarts.TooltipComponentOption)
}
