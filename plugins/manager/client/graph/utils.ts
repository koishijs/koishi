import { PluginData } from '@koishijs/plugin-manager/src'
import { store } from '~/client'
import { Dict } from 'koishi'
import { computed } from 'vue'

type Bound = [number, number][]

export interface Node {
  col: number
  row: number
  data: PluginData
  parent?: Node
}

export interface Edge {
  id: string
  source: string
  target: string
}

const nodeWidth = 14
const nodeHeight = 5
const gridWidth = 20
const gridHeight = 6

export const graph = computed(() => {
  const nodes: Dict<Node> = {}
  const edges: Edge[] = []

  function shift(data: PluginData, offset: number) {
    nodes[data.id].row += offset
    for (const child of data.children) {
      shift(child, offset)
    }
  }

  function traverse(data: PluginData, col: number): Bound {
    const bound: Bound = []

    data.children.forEach((child, index) => {
      let offset = -Infinity
      const temp = traverse(child, col + 1)
      for (let index = 0; index < Math.min(temp.length, bound.length); index++) {
        offset = Math.max(offset, bound[index][1] - temp[index][0])
      }
      if (offset === -Infinity) offset = 0
      if (offset > 0) {
        shift(child, offset)
        for (let index = 0; index < temp.length; index++) {
          temp[index][0] += offset
          temp[index][1] += offset
        }
      } else if (offset < 0) {
        while (index > 0) {
          index -= 1
          shift(data.children[index], -offset)
        }
        for (let index = 0; index < bound.length; index++) {
          bound[index][0] -= offset
          bound[index][1] -= offset
        }
      }
      for (let index = 0; index < temp.length; index++) {
        if (bound[index]) {
          bound[index][1] = temp[index][1]
        } else {
          bound.push(temp[index])
        }
      }
      edges.push({
        source: data.id,
        target: child.id,
        id: data.id + '-' + child.id,
      })
    })

    const row = bound.length
      ? (bound[0][0] + bound[0][1] - 1) / 2
      : 0
    bound.unshift([row, row + 1])

    const parent = nodes[data.id] = { col, row, data }
    for (const child of data.children) {
      nodes[child.id].parent = parent
    }

    return bound
  }

  const result = traverse(store.registry, 0)
  const rowMax = result.length
  const colMax = Math.max(...result.map(p => p[1]))
  const width = (rowMax - 1) * gridWidth + nodeWidth + 'rem'
  const height = (colMax - 1) * gridHeight + nodeHeight + 'rem'

  return { nodes, edges, width, height }
})

export function getStyle(node: Node) {
  return {
    left: `${node.col * gridWidth}rem`,
    top: `${node.row * gridHeight}rem`,
  }
}

export function getPath(edge: Edge) {
  const source = graph.value.nodes[edge.source]
  const target = graph.value.nodes[edge.target]

  const xSource = source.col * gridWidth + nodeWidth
  const xTarget = target.col * gridWidth
  const xMiddle = (xSource + xTarget) / 2
  const ySource = source.row * gridHeight + nodeHeight / 2
  const yTarget = target.row * gridHeight + nodeHeight / 2
  if (ySource === yTarget) {
    return `M ${xSource} ${ySource} H ${xTarget}`
  }

  const sign = Math.sign(yTarget - ySource)
  const x1 = xMiddle - 2
  const x2 = xMiddle
  const x3 = xMiddle
  const x4 = xMiddle + 2
  const y1 = ySource
  const y2 = ySource + 1.75 * sign
  const y3 = yTarget - 1.75 * sign
  const y4 = yTarget

  const curve1 = `${x2} ${ySource} ${xMiddle} ${y1} ${xMiddle} ${y2}`
  const curve2 = `${xMiddle} ${y4} ${x3} ${yTarget} ${x4} ${yTarget}`
  return `M ${xSource} ${ySource} H ${x1} C ${curve1} V ${y3} C ${curve2} H ${xTarget}`
}
