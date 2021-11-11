import * as echarts from 'echarts'

interface CommonData {
  name: string
  value: number
}

export namespace Tooltip {
  type FormatterCallback<T> = (params: T) => string
  type FormatterCallbackParams<T> = echarts.DefaultLabelFormatterCallbackParams & { data: T }

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