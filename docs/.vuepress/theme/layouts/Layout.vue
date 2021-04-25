<script>

import parentLayout from '@parent-theme/layouts/Layout.vue'

function adjustSidebarItems (items) {
  items.forEach(item => {
    if (item.children) {
      adjustSidebarItems(item.children)
    } else if (item.headers) {
      item.headers.forEach(header => {
        header.title = header.title.replace(/(\S)\(.+\)(?=\s|$)/, '$1()')
      })
    }
  })
}

const getSidebarItems = parentLayout.computed.sidebarItems
parentLayout.computed.sidebarItems = function () {
  const items = getSidebarItems.call(this)
  adjustSidebarItems(items)
  return items
}

export default parentLayout

</script>
