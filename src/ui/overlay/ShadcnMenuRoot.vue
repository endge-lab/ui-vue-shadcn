<script setup lang="ts">
import type { ContextMenuItemDescriptor } from '@endge/core'
import { Endge } from '@endge/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import {
  closeShadcnMenu,
  executeShadcnMenuItem,
  getShadcnMenuItems,
  resolveShadcnMenuItemLabel,
  shadcnMenuState,
} from '@/ui/overlay/shadcn-menu-manager'
import ShadcnIcon from '@/ui/primitives/ShadcnIcon.vue'

const menuRef = ref<HTMLElement | null>(null)
const i18nVersion = ref(0)
const position = ref({ left: '0px', top: '0px' })
const executing = ref(false)
let unsubscribeI18n: (() => void) | null = null

const menuItems = computed(() => {
  i18nVersion.value
  return getShadcnMenuItems()
})

watch(
  () => shadcnMenuState.open,
  async (open) => {
    if (!open) {
      removeGlobalListeners()
      return
    }
    addGlobalListeners()
    await nextTick()
    placeMenu()
    menuRef.value?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)

onMounted(() => {
  unsubscribeI18n = Endge.i18n.subscribe(() => i18nVersion.value++)
})

onBeforeUnmount(() => {
  removeGlobalListeners()
  unsubscribeI18n?.()
})

function addGlobalListeners(): void {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', closeOnViewportChange, { passive: true })
  window.addEventListener('scroll', closeOnViewportChange, { passive: true, capture: true })
}

function removeGlobalListeners(): void {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', closeOnViewportChange)
  window.removeEventListener('scroll', closeOnViewportChange, true)
}

function onDocumentMouseDown(event: MouseEvent): void {
  if (!menuRef.value?.contains(event.target as Node)) {
    closeShadcnMenu()
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeShadcnMenu()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    return
  }
  const buttons = [...(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
  if (buttons.length === 0) {
    return
  }
  event.preventDefault()
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? buttons.length - 1
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
}

function closeOnViewportChange(): void {
  closeShadcnMenu()
}

function placeMenu(): void {
  const menu = menuRef.value
  if (!menu) {
    return
  }
  const anchor = shadcnMenuState.anchor
  const margin = 8
  const desiredLeft = anchor.kind === 'element' ? anchor.left : anchor.x
  const desiredTop = anchor.kind === 'element' ? anchor.bottom + 4 : anchor.y
  const left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - menu.offsetWidth - margin))
  const top = Math.max(margin, Math.min(desiredTop, window.innerHeight - menu.offsetHeight - margin))
  position.value = { left: `${left}px`, top: `${top}px` }
}

async function runItem(item: ContextMenuItemDescriptor): Promise<void> {
  if (executing.value || item.disabled) {
    return
  }
  executing.value = true
  try {
    await executeShadcnMenuItem(item)
  }
  catch (error) {
    console.error(`[ShadcnMenu] Action "${item.action}" failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    executing.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="shadcnMenuState.open && menuItems.length > 0"
      ref="menuRef"
      role="menu"
      data-slot="dropdown-menu-content"
      class="endge-shadcn-menu-root"
      :style="position"
      @click.stop
      @contextmenu.prevent.stop
    >
      <template v-for="item in menuItems" :key="item.id">
        <div
          v-if="item.kind === 'separator'"
          role="separator"
          class="endge-shadcn-menu-root__separator"
        />
        <button
          v-else
          type="button"
          role="menuitem"
          data-slot="dropdown-menu-item"
          class="endge-shadcn-menu-root__item"
          :disabled="executing || item.disabled"
          @click="runItem(item)"
        >
          <ShadcnIcon
            v-if="item.icon"
            class="endge-shadcn-menu-root__icon"
            :name="item.icon"
            :size="14"
          />
          <span class="endge-shadcn-menu-root__label">{{ resolveShadcnMenuItemLabel(item) }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>
