import type {
  ComponentSFCInteractionTrigger,
  ComponentSFCInteractionTriggerEvent,
  ComponentSFCInteractionTriggerPlatform,
  ComponentSFCEventRuntimeSource,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_EventModifier,
  RComponentSFC_IR_EventBinding,
  RComponentSFC_IR_InteractionRule,
} from '@endge/core'
import {
  matchesComponentSFCInteractionTrigger,
  normalizeComponentSFCInteractionTriggers,
  resolveComponentSFCInteractionTriggerPlatform,
} from '@endge/core'

import type { SFCVueRenderContext } from '@/domain/types/sfc-render.type'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

const claimedGroups = new WeakMap<Event, Set<string>>()

/** Adds conditional `:on` listeners to one renderer-owned visual node. */
export function attachSFCInteractionAttrs(
  attrs: Record<string, unknown>,
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): void {
  const boundary = context.eventBoundary
  if (!boundary || !node.interactions?.length || node.tag === 'Component') return
  const source: ComponentSFCEventRuntimeSource = {
    nodeId: node.id,
    ref: typeof props.ref === 'string' && props.ref.trim() ? props.ref.trim() : undefined,
    componentTag: node.componentTag ?? node.tag,
    target: {
      type: 'component.node',
      identity: String(props.id ?? props.ref ?? node.id),
      value: null,
    },
  }

  node.interactions.forEach((group, groupIndex) => {
    const evaluated = group.rules.flatMap((rule, ruleIndex) => {
      const trigger = normalizeComponentSFCInteractionTriggers(evaluateSFCValue(rule.trigger, context))[0]
      if (!trigger) return []
      const normalized = applySuffixModifiers(trigger, rule.modifiers)
      if (normalized.held) ensureSFCInteractionKeyState()
      return [{ rule, ruleIndex, trigger: normalized }]
    })
    const listenerKeys = [...new Set(evaluated.map(({ rule }) => listenerKey(rule)))]
    for (const key of listenerKeys) {
      const [eventName, captureToken, passiveToken] = key.split('|')
      const capture = captureToken === '1'
      const passive = passiveToken === '1'
      const propName = vueEventPropName(eventName, { capture, passive })
      chainSFCEventAttr(attrs, propName, (event: Event) => {
        const claimKey = `${context.consumerScope}:${node.id}:${groupIndex}`
        if (claimedGroups.get(event)?.has(claimKey)) return
        const snapshot = createSFCInteractionTriggerEvent(event)
        const selected = evaluated.find(({ trigger }) => (
          trigger.event === eventName
          && matchesComponentSFCInteractionTrigger(trigger, snapshot, resolveSFCInteractionPlatform())
        ))
        if (!selected || listenerKey(selected.rule) !== key) return
        if (selected.trigger.once) {
          const onceKey = `${claimKey}:${selected.ruleIndex}:${selected.rule.sourceRange?.start ?? 0}`
          if (!boundary.claimLocalOnce(onceKey)) return
        }
        let claims = claimedGroups.get(event)
        if (!claims) {
          claims = new Set()
          claimedGroups.set(event, claims)
        }
        claims.add(claimKey)
        if (selected.trigger.prevent && event.cancelable) event.preventDefault()
        if (selected.trigger.stop) event.stopPropagation()

        const runtimeSource: ComponentSFCEventRuntimeSource = {
          ...source,
          target: source.target ? { ...source.target, value: event.currentTarget } : undefined,
        }
        const modifiers = interactionBindingModifiers(selected.trigger)
        void boundary.routeChild(
          runtimeSource,
          eventName,
          normalizeSFCInteractionEvent(event, snapshot),
          [{
            name: eventName,
            modifiers,
            action: selected.rule.reactions[0]!,
            actions: selected.rule.reactions,
            sourceRange: selected.rule.sourceRange,
          }],
          [],
          0,
          { ...context.props, ...context.locals },
        )
      })
    }
  })
}

/** Projects `:on` groups of a nested SFC to its semantic Event boundary. */
export function createSFCSemanticInteractionBindings(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
): RComponentSFC_IR_EventBinding[] {
  return (node.interactions ?? []).flatMap(group => {
    const seenEvents = new Set<string>()
    return group.rules.flatMap((rule) => {
      if (seenEvents.has(rule.event)) return []
      const trigger = normalizeComponentSFCInteractionTriggers(evaluateSFCValue(rule.trigger, context))[0]
      if (!trigger) return []
      const normalized = applySuffixModifiers(trigger, rule.modifiers)
      seenEvents.add(rule.event)
      const bindingModifiers = interactionBindingModifiers(normalized)
      if (normalized.once) bindingModifiers.push('once')
      return [{
        name: rule.event,
        modifiers: bindingModifiers,
        action: rule.reactions[0]!,
        actions: rule.reactions,
        sourceRange: rule.sourceRange,
      }]
    })
  })
}

export function applySuffixModifiers(
  trigger: ComponentSFCInteractionTrigger,
  modifiers: readonly RComponentSFC_IR_EventModifier[] = [],
): ComponentSFCInteractionTrigger {
  return {
    ...trigger,
    stop: trigger.stop || modifiers.includes('stop'),
    prevent: trigger.prevent || modifiers.includes('prevent'),
    self: trigger.self || modifiers.includes('self'),
    once: trigger.once || modifiers.includes('once'),
    capture: trigger.capture || modifiers.includes('capture'),
    passive: trigger.passive || modifiers.includes('passive'),
  }
}

export function createSFCInteractionTriggerEvent(event: Event): ComponentSFCInteractionTriggerEvent {
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
    held: sfcInteractionHeldKeys(),
    modifiers: {
      ctrl: source.ctrlKey === true,
      shift: source.shiftKey === true,
      alt: source.altKey === true,
      meta: source.metaKey === true,
      altGraph: source.getModifierState?.('AltGraph') === true,
    },
  }
}

export function normalizeSFCInteractionEvent(
  event: Event,
  snapshot = createSFCInteractionTriggerEvent(event),
): Record<string, unknown> {
  const source = event as Event & Record<string, unknown>
  const target = event.target as { value?: unknown, checked?: unknown, multiple?: boolean, selectedOptions?: Iterable<{ value: string }> } | null
  const payload: Record<string, unknown> = {
    type: event.type,
    held: snapshot.held ?? { key: [], code: [] },
    modifiers: snapshot.modifiers,
  }
  if ('clientX' in source) {
    payload.x = Number(source.clientX ?? 0)
    payload.y = Number(source.clientY ?? 0)
    payload.button = Number(source.button ?? 0)
    payload.buttons = Number(source.buttons ?? 0)
    payload.pointerType = typeof source.pointerType === 'string' ? source.pointerType : 'mouse'
  }
  if (snapshot.key !== undefined) {
    payload.key = snapshot.key
    payload.code = snapshot.code ?? ''
    payload.repeat = snapshot.repeat === true
    payload.composing = snapshot.composing === true
  }
  if ('deltaX' in source) {
    payload.deltaX = Number(source.deltaX ?? 0)
    payload.deltaY = Number(source.deltaY ?? 0)
  }
  if (target && ('value' in target || 'checked' in target)) {
    payload.value = target.multiple && target.selectedOptions
      ? Array.from(target.selectedOptions, option => option.value)
      : target.value
    if (typeof target.checked === 'boolean') payload.checked = target.checked
  }
  return payload
}

interface InteractionHeldKeyEntry { key: string, code?: string }
interface InteractionKeyState { entries: Map<string, InteractionHeldKeyEntry> }

const interactionKeyStates = new WeakMap<Document, InteractionKeyState>()
const modifierKeys = new Set([
  'Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'FnLock', 'Hyper', 'Meta', 'NumLock',
  'OS', 'ScrollLock', 'Shift', 'Super', 'Symbol', 'SymbolLock',
])

export function ensureSFCInteractionKeyState(): InteractionKeyState | null {
  if (typeof document === 'undefined') return null
  const current = interactionKeyStates.get(document)
  if (current) return current
  const state: InteractionKeyState = { entries: new Map() }
  const reset = () => state.entries.clear()
  document.addEventListener('keydown', (event) => {
    if (modifierKeys.has(event.key)) return
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
  interactionKeyStates.set(document, state)
  return state
}

export function resolveSFCInteractionPlatform(): ComponentSFCInteractionTriggerPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const source = navigator as Navigator & { userAgentData?: { platform?: string } }
  return resolveComponentSFCInteractionTriggerPlatform(source.userAgentData?.platform ?? source.platform ?? source.userAgent)
}

function sfcInteractionHeldKeys(): NonNullable<ComponentSFCInteractionTriggerEvent['held']> {
  const entries = [...(ensureSFCInteractionKeyState()?.entries.values() ?? [])]
  return {
    key: [...new Set(entries.map(entry => entry.key))],
    code: [...new Set(entries.flatMap(entry => entry.code ? [entry.code] : []))],
  }
}

function listenerKey(rule: RComponentSFC_IR_InteractionRule): string {
  return `${rule.event}|${rule.listener.capture ? '1' : '0'}|${rule.listener.passive ? '1' : '0'}`
}

function interactionBindingModifiers(trigger: ComponentSFCInteractionTrigger): RComponentSFC_IR_EventModifier[] {
  return (['stop', 'prevent', 'self', 'capture', 'passive'] as const).filter(name => trigger[name] === true)
}

function vueEventPropName(name: string, options: { capture: boolean, passive: boolean }): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}${options.capture ? 'Capture' : ''}${options.passive ? 'Passive' : ''}`
}

export function chainSFCEventAttr(attrs: Record<string, unknown>, name: string, next: (event: any) => void): void {
  const previous = attrs[name]
  attrs[name] = (event: Event) => {
    if (typeof previous === 'function') previous(event)
    next(event)
  }
}
