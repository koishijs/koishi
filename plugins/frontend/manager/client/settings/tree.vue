<template>
  <el-scrollbar class="plugin-tree" ref="root">
    <div class="search">
      <el-input v-model="keyword" #suffix>
        <k-icon name="search"></k-icon>
      </el-input>
    </div>
    <k-tab-item class="k-tab-group-title" label="@global" v-model="model">全局设置</k-tab-item>
    <el-tree
      ref="tree"
      node-key="id"
      :data="plugins.data"
      :draggable="true"
      :auto-expand-parent="false"
      :default-expanded-keys="plugins.expanded"
      :expand-on-click-node="false"
      :filter-node-method="filterNode"
      :props="{ class: getClass }"
      :allow-drag="allowDrag"
      :allow-drop="allowDrop"
      @node-click="handleClick"
      @node-drop="handleDrop"
      @node-expand="handleExpand"
      @node-collapse="handleCollapse"
      #="{ node }">
      <div class="item">
        <div class="label">{{ node.label === 'group' ? '分组：' + node.data.alias : node.label || '待添加' }}</div>
        <div class="remove" @click.stop="remove(node.data)">
          <k-icon name="trash-can"></k-icon>
        </div>
      </div>
    </el-tree>
  </el-scrollbar>
</template>

<script lang="ts" setup>

import { ref, computed, onActivated, nextTick, watch } from 'vue'
import { send, messageBox } from '@koishijs/client'
import { Tree, plugins, setPath } from './utils'

const props = defineProps<{
  modelValue: string
}>()

const emits = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: val => emits('update:modelValue', val),
})

function filterNode(value: string, data: Tree) {
  return data.label.includes(keyword.value)
}

function allowDrag(node: Node) {
  return node.data.path !== ''
}

interface Node {
  data: Tree
  parent: Node
  expanded: boolean
  isLeaf: boolean
  childNodes: Node[]
}

function allowDrop(source: Node, target: Node, type: 'inner' | 'prev' | 'next') {
  if (type !== 'inner') return target.data.path !== ''
  const segments = target.data.path.split('/')
  return segments[segments.length - 1].startsWith('group:')
}

function handleClick(tree: Tree) {
  model.value = tree.path
}

function handleExpand(data: Tree, target: Node, instance) {
  send('manager/meta', data.path, { $collapsed: null })
}

function handleCollapse(data: Tree, target: Node, instance) {
  send('manager/meta', data.path, { $collapsed: true })
}

function handleDrop(source: Node, target: Node, position: 'before' | 'after' | 'inner', event: DragEvent) {
  const parent = position === 'inner' ? target : target.parent
  const oldPath = source.data.path
  const ctxPath = parent.data.path
  const index = parent.childNodes.findIndex(node => node.data.path === oldPath)
  send('manager/teleport', oldPath, ctxPath, index)
  const segments1 = oldPath.split('/')
  const segments2 = ctxPath ? ctxPath.split('/') : []
  segments2.push(segments1.pop())
  setPath(oldPath, segments2.join('/'))
}

function getClass(tree: Tree) {
  const words: string[] = []
  if (tree.children) words.push('is-group')
  if (tree.disabled) words.push('is-disabled')
  if (tree.path === model.value) words.push('is-active')
  return words.join(' ')
}

function remove(tree: Tree) {
  messageBox.confirm('确定要删除吗？', '删除插件', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    send('manager/remove', tree.path)
  }, () => {})
}

const root = ref<{ $el: HTMLElement }>(null)
const tree = ref(null)
const keyword = ref('')

watch(keyword, (val) => {
  tree.value.filter(val)
})

onActivated(async () => {
  const container = root.value.$el
  await nextTick()
  const element = container.querySelector('.k-tab-item.active') as HTMLElement
  if (!element) return
  root.value['setScrollTop'](element.offsetTop - (container.offsetHeight - element.offsetHeight) / 2)
})

</script>

<style lang="scss">

.plugin-tree {
  width: 100%;
  height: 100%;
  border-right: 1px solid var(--border);
  overflow: auto;

  .el-scrollbar__view {
    padding: 1rem 0;
    line-height: 2.25rem;
  }

  .search {
    padding: 0 1.5rem;
  }

  .k-icon-filter {
    height: 15px;
  }

  .readonly {
    color: var(--fg3t);
  }

  .el-tree {
    margin-top: 0.5rem;
    user-select: none;
  }

  .el-tree-node__expand-icon {
    margin-left: 8px;
  }

  .el-tree-node {
    &.is-group > .el-tree-node__content {
      font-weight: bold;
    }

    &:focus:not(:hover) > .el-tree-node__content {
      background-color: unset;
    }

    &.is-disabled > .el-tree-node__content .label {
      color: var(--fg3t);
    }

    // &:not(.is-disabled) > .el-tree-node__content .remove {
    //   color: var(--error);
    // }

    &.is-active > .el-tree-node__content {
      background-color: var(--hover-bg);
      color: var(--active);
    }
  }

  .el-tree-node__content {
    line-height: 2.25rem;
    height: 2.25rem;
    transition: var(--color-transition);

    .item {
      flex: 1;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      overflow: hidden;
    }

    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      transition: var(--color-transition);
    }

    .remove {
      display: flex;
      height: 100%;
      width: 2.5rem;
      justify-content: center;
      align-items: center;
      opacity: 0;
      color: var(--fg3);
      transition: var(--color-transition);

      &:hover {
        opacity: 1 !important;
      }
    }

    &:hover {
      background-color: var(--hover-bg);
      .remove {
        opacity: 0.75;
      }
    }
  }

  .el-tree-node__label {
    font-size: 16px;
  }
}

</style>
