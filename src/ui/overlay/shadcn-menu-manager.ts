import type {
  ContextMenuDescriptor,
  ContextMenuItemDescriptor,
  ContextMenuNodeDescriptor,
  RuntimeActionContext,
} from '@endge/core'
import { Endge } from '@endge/core'
import { reactive } from 'vue'

export type ShadcnMenuAnchor
  = | { kind: 'point', x: number, y: number }
    | { kind: 'element', left: number, top: number, right: number, bottom: number }

export interface ShadcnMenuOpenInput<TContext extends RuntimeActionContext = RuntimeActionContext> {
  ownerId: string
  anchor: ShadcnMenuAnchor
  menu: ContextMenuDescriptor
  context: TContext
}

export interface ShadcnMenuState {
  open: boolean
  ownerId: string | null
  anchor: ShadcnMenuAnchor
  menu: ContextMenuDescriptor | null
  context: RuntimeActionContext | null
}

export const shadcnMenuState = reactive<ShadcnMenuState>({
  open: false,
  ownerId: null,
  anchor: { kind: 'point', x: 0, y: 0 },
  menu: null,
  context: null,
})

export function elementMenuAnchor(element: Element): ShadcnMenuAnchor {
  const rect = element.getBoundingClientRect()
  return {
    kind: 'element',
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

export function pointMenuAnchor(x: number, y: number): ShadcnMenuAnchor {
  return { kind: 'point', x, y }
}

export function openShadcnMenu(input: ShadcnMenuOpenInput): void {
  shadcnMenuState.open = true
  shadcnMenuState.ownerId = input.ownerId
  shadcnMenuState.anchor = input.anchor
  shadcnMenuState.menu = input.menu
  shadcnMenuState.context = input.context
}

export function closeShadcnMenu(ownerId?: string): void {
  if (ownerId && shadcnMenuState.ownerId !== ownerId) {
    return
  }

  shadcnMenuState.open = false
  shadcnMenuState.ownerId = null
  shadcnMenuState.menu = null
  shadcnMenuState.context = null
}

export function getShadcnMenuItems(): ContextMenuNodeDescriptor[] {
  const menu = shadcnMenuState.menu
  const context = shadcnMenuState.context
  if (!menu || !context) {
    return []
  }

  return compactSeparators(menu.items)
}

export const getExecutableShadcnMenuItems = getShadcnMenuItems

export async function executeShadcnMenuItem(item: ContextMenuItemDescriptor): Promise<void> {
  const context = shadcnMenuState.context
  if (!context) {
    return
  }

  try {
    await Endge.runtime.actions.execute(item.action, context, item.input)
  }
  finally {
    closeShadcnMenu()
  }
}

export function resolveShadcnMenuItemLabel(item: ContextMenuItemDescriptor): string {
  try {
    if (Endge.i18n.te(item.label)) {
      return Endge.i18n.t(item.label, { defaultValue: item.label })
    }
    if (item.action !== item.label && Endge.i18n.te(item.action)) {
      return Endge.i18n.t(item.action, { defaultValue: item.label })
    }
  }
  catch {
    // Shell может смонтироваться до гидратации локали workspace; метка описателя служит безопасным fallback.
  }
  return item.label
}

function compactSeparators(items: ContextMenuNodeDescriptor[]): ContextMenuNodeDescriptor[] {
  const result: ContextMenuNodeDescriptor[] = []
  for (const item of items) {
    if (item.kind !== 'separator') {
      result.push(item)
      continue
    }
    if (result.length > 0 && result.at(-1)?.kind !== 'separator') {
      result.push(item)
    }
  }
  if (result.at(-1)?.kind === 'separator') {
    result.pop()
  }
  return result
}
