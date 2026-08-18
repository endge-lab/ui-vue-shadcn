import type {
  ComponentSFCEditTriggerEvent,
  ComponentSFCEditTriggerPlatform,
  ComponentSFCEventRuntimeSource,
  ComponentSFCEditedEventPayload,
  RComponentSFC_IR_ElementNode,
} from '@endge/core'
import {
  matchesComponentSFCEditTrigger,
  normalizeComponentSFCEditTriggers,
  resolveComponentSFCEditTriggerPlatform,
} from '@endge/core'
import { isoToDateTimeLocalInput } from '@endge/utils'

import type {
  SFCVueRenderContext,
  SFCVueRenderElementInput,
  SFCVueRenderResult,
} from '@/domain/types/sfc-render.type'
import { requireSFCAdapterRenderer } from '@/ui/render/sfc/SFCRender_Adapter'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

/** Stable host-owned key shared by display, edit and virtualized Table renders. */
export function editableConsumerKey(node: RComponentSFC_IR_ElementNode, context: SFCVueRenderContext): string {
  return `${context.consumerScope}/editable:${node.id}`
}

/** Returns true while this exact consumer owns the runtime's single edit session. */
export function isSFCEditableActive(node: RComponentSFC_IR_ElementNode, context: SFCVueRenderContext): boolean {
  return Boolean(node.editable && context.host?.getEditSession(editableConsumerKey(node, context)))
}

/** Adds entry/cancel/commit listeners without replacing authored semantic handlers. */
export function attachSFCEditableAttrs(
  attrs: Record<string, unknown>,
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): void {
  if (!node.editable || !context.host) return
  const key = editableConsumerKey(node, context)
  const active = context.host.getEditSession(key)
  if (active) {
    chainAttr(attrs, 'onKeydown', (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      context.host?.cancelEditSession(key)
    })
    if (node.tag === 'Editable') {
      chainAttr(attrs, 'onInput', (event: Event) => context.host?.updateEditDraft(key, readTargetValue(event, node.tag)))
      chainAttr(attrs, 'onChange', (event: Event) => void commitEditable(node, context, readTargetValue(event, node.tag)))
    }
    return
  }

  const triggerValue = evaluateSFCValue(node.editable.triggers, context)
  const triggers = normalizeComponentSFCEditTriggers(triggerValue)
  if (triggers.some(trigger => trigger.held)) ensureEditTriggerKeyState()
  for (const trigger of triggers) {
    const attr = vueEventPropName(trigger.event)
    chainAttr(attrs, attr, (event: Event) => {
      if (!matchesComponentSFCEditTrigger(trigger, editTriggerEvent(event), editTriggerPlatform())) return
      if (trigger.prevent && event.cancelable) event.preventDefault()
      if (trigger.stop) event.stopPropagation()
      const original = evaluateSFCValue(node.editable?.value, context)
      const baseVariant = String(props.variant ?? context.variant ?? 'default')
      context.host?.beginEditSession(key, original, baseVariant)
    })
  }
}

/** Renders built-in editors for the three primitive shortcuts. */
export function renderSFCEditablePrimitive(
  input: SFCVueRenderElementInput & { props: Record<string, unknown>, attrs: Record<string, unknown> },
): SFCVueRenderResult | undefined {
  if (!input.node.editable || !['Text', 'Number', 'DateTime'].includes(input.node.tag)) return undefined
  const host = input.context.host
  if (!host) return undefined
  const key = editableConsumerKey(input.node, input.context)
  const session = host.getEditSession(key)
  if (!session) return undefined

  const type = input.node.tag === 'Number'
    ? 'Number'
    : input.node.tag === 'DateTime'
      ? 'DateTime'
      : 'String'
  const value = input.node.tag === 'DateTime'
    ? isoToDateTimeLocalInput(session.draftValue)
    : session.draftValue == null ? '' : session.draftValue
  const attrs = { ...input.attrs }
  delete attrs.onClick
  delete attrs.onDblclick
  delete attrs.onFocus

  const renderInput = requireSFCAdapterRenderer('Input')
  return renderInput({
    ...input,
    children: [],
    props: {
      ...input.props,
      class: ['endge-sfc-editable-input', input.props.class],
      type,
      value,
    },
    attrs: {
      ...attrs,
      autofocus: true,
      ref: ((element: unknown) => focusSFCEditableControl(element)) as any,
      onInput: (event: Event) => host.updateEditDraft(key, readTargetValue(event, input.node.tag)),
      onChange: (event: Event) => void commitEditable(input.node, input.context, readTargetValue(event, input.node.tag)),
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          host.cancelEditSession(key)
        }
        else if (event.key === 'Enter') {
          event.preventDefault()
          void commitEditable(input.node, input.context, readTargetValue(event, input.node.tag))
        }
      },
    },
  })
}

/** Commits an editable child event and returns the normalized payload for parent routing. */
export function commitSFCEditableChild(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  payload: unknown,
): ComponentSFCEditedEventPayload | null {
  const key = editableConsumerKey(node, context)
  const value = isEditedPayload(payload) ? payload.value : payload
  return context.host?.commitEditSession(key, value) ?? null
}

async function commitEditable(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  value: unknown,
): Promise<void> {
  const key = editableConsumerKey(node, context)
  const payload = context.host?.commitEditSession(key, value)
  if (!payload || !context.eventBoundary) return
  const source: ComponentSFCEventRuntimeSource = {
    nodeId: node.id,
    componentTag: node.componentTag ?? node.tag,
  }
  await context.eventBoundary.routeChild(
    source,
    'edited',
    payload,
    node.events ?? [],
    [],
    0,
    { ...context.props, ...context.locals },
  )
}

function editTriggerEvent(event: Event): ComponentSFCEditTriggerEvent {
  const source = event as Event & {
    altKey?: unknown
    button?: unknown
    code?: unknown
    ctrlKey?: unknown
    getModifierState?: (keyArg: string) => boolean
    isComposing?: unknown
    key?: unknown
    metaKey?: unknown
    repeat?: unknown
    shiftKey?: unknown
  }
  return {
    ...(typeof source.key === 'string' ? { key: source.key } : {}),
    ...(typeof source.code === 'string' ? { code: source.code } : {}),
    ...(typeof source.repeat === 'boolean' ? { repeat: source.repeat } : {}),
    ...(typeof source.isComposing === 'boolean' ? { composing: source.isComposing } : {}),
    ...(typeof source.button === 'number' ? { button: source.button } : {}),
    targetIsCurrentTarget: event.target === event.currentTarget,
    held: editTriggerHeldKeys(),
    modifiers: {
      ctrl: source.ctrlKey === true,
      shift: source.shiftKey === true,
      alt: source.altKey === true,
      meta: source.metaKey === true,
      altGraph: source.getModifierState?.('AltGraph') === true,
    },
  }
}

interface EditTriggerHeldKeyEntry {
  key: string
  code?: string
}

interface EditTriggerKeyState {
  entries: Map<string, EditTriggerHeldKeyEntry>
}

const editTriggerKeyStates = new WeakMap<Document, EditTriggerKeyState>()
const editTriggerModifierKeys = new Set([
  'Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'FnLock', 'Hyper', 'Meta', 'NumLock',
  'OS', 'ScrollLock', 'Shift', 'Super', 'Symbol', 'SymbolLock',
])

function ensureEditTriggerKeyState(): EditTriggerKeyState | null {
  if (typeof document === 'undefined') return null
  const current = editTriggerKeyStates.get(document)
  if (current) return current

  const state: EditTriggerKeyState = { entries: new Map() }
  const reset = () => state.entries.clear()
  document.addEventListener('keydown', (event) => {
    if (editTriggerModifierKeys.has(event.key)) return
    const key = event.key.toLowerCase()
    const identity = event.code || `key:${key}`
    state.entries.set(identity, { key, ...(event.code ? { code: event.code } : {}) })
  }, true)
  document.addEventListener('keyup', (event) => {
    if (event.code) state.entries.delete(event.code)
    else state.entries.delete(`key:${event.key.toLowerCase()}`)
  }, true)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') reset()
  })
  document.defaultView?.addEventListener('blur', reset)
  document.defaultView?.addEventListener('pagehide', reset)
  editTriggerKeyStates.set(document, state)
  return state
}

function editTriggerHeldKeys(): NonNullable<ComponentSFCEditTriggerEvent['held']> {
  const entries = [...(ensureEditTriggerKeyState()?.entries.values() ?? [])]
  return {
    key: [...new Set(entries.map(entry => entry.key))],
    code: [...new Set(entries.flatMap(entry => entry.code ? [entry.code] : []))],
  }
}

function editTriggerPlatform(): ComponentSFCEditTriggerPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const source = navigator as Navigator & { userAgentData?: { platform?: string } }
  return resolveComponentSFCEditTriggerPlatform(source.userAgentData?.platform ?? source.platform ?? source.userAgent)
}

function readTargetValue(event: Event, tag: string): unknown {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) return undefined
  if (tag === 'Number') {
    const value = Number(target.value)
    return target.value === '' || !Number.isFinite(value) ? null : value
  }
  return target.value
}

function focusSFCEditableControl(target: unknown): void {
  const component = target as { $el?: unknown } | null
  const root = component?.$el ?? target
  const focusableRoot = asFocusable(root)
  if (focusableRoot) {
    focusableRoot.focus()
    return
  }

  const container = root as { querySelector?: (selector: string) => unknown } | null
  const control = container?.querySelector?.('input, textarea, select, button, [tabindex]:not([tabindex="-1"])')
  asFocusable(control)?.focus()
}

function asFocusable(value: unknown): { focus: () => void } | null {
  if (!value || typeof value !== 'object') return null
  const focus = (value as { focus?: unknown }).focus
  return typeof focus === 'function' ? { focus: () => focus.call(value) } : null
}

function vueEventPropName(name: string): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

function chainAttr(attrs: Record<string, unknown>, name: string, next: (event: any) => void): void {
  const previous = attrs[name]
  attrs[name] = (event: Event) => {
    if (typeof previous === 'function') previous(event)
    next(event)
  }
}

function isEditedPayload(value: unknown): value is ComponentSFCEditedEventPayload {
  return Boolean(value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value'))
}
