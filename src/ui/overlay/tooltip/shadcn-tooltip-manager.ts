import type { EndgeTooltipConfiguration } from '@endge/core'
import type { InjectionKey, VNodeChild } from 'vue'
import {
  Endge,
  ENDGE_KEYBOARD_CONTEXT_RAPH_PATH,
  matchesComponentSFCInteractionKeyboardCondition,
  normalizeComponentSFCInteractionKeyboardCondition,
} from '@endge/core'
import { Raph } from '@endge/raph'
import { shallowReactive } from 'vue'

export type ShadcnTooltipReason = 'pointer' | 'focus'
export type ShadcnTooltipKind = 'text' | 'markdown' | 'rich'

export interface ShadcnTooltipRequest {
  ownerId: string
  domId: string
  anchor: HTMLElement
  kind: ShadcnTooltipKind
  policy?: Partial<EndgeTooltipConfiguration>
  className?: unknown
  authoredId?: string
  part?: string
  renderContent: () => VNodeChild
}

export interface ShadcnTooltipState {
  phase: 'idle' | 'pending' | 'visible'
  ownerId: string | null
  domId: string | null
  anchor: HTMLElement | null
  kind: ShadcnTooltipKind
  policy: EndgeTooltipConfiguration
  className: unknown
  authoredId: string | null
  part: string | null
  content: VNodeChild | null
}

/** Shadcn-specific single-overlay manager; it never registers dormant cell instances. */
export class ShadcnTooltipManager {
  public readonly state: ShadcnTooltipState
  private readonly defaults: EndgeTooltipConfiguration
  private request: ShadcnTooltipRequest | null = null
  private reasons = new Set<ShadcnTooltipReason>()
  private openTimer: ReturnType<typeof setTimeout> | null = null
  private closeTimer: ReturnType<typeof setTimeout> | null = null
  private generation = 0
  private disposed = false
  private readonly disposeKeyboardWatch: () => void

  public constructor(defaults: EndgeTooltipConfiguration) {
    this.defaults = { ...defaults }
    this.state = shallowReactive({
      phase: 'idle',
      ownerId: null,
      domId: null,
      anchor: null,
      kind: 'text',
      policy: { ...defaults },
      className: null,
      authoredId: null,
      part: null,
      content: null,
    })
    this.disposeKeyboardWatch = Raph.watch([
      ENDGE_KEYBOARD_CONTEXT_RAPH_PATH,
      `${ENDGE_KEYBOARD_CONTEXT_RAPH_PATH}.*`,
    ], () => this.reconcileActivation())
  }

  public activate(request: ShadcnTooltipRequest, reason: ShadcnTooltipReason): void {
    if (this.disposed || !request.anchor.isConnected) {
      return
    }
    this.clearClose()
    if (this.request?.ownerId !== request.ownerId) {
      this.hide()
      this.reasons.clear()
    }
    this.request = request
    this.reasons.add(reason)
    this.reconcileActivation()
  }

  public deactivate(ownerId: string, reason: ShadcnTooltipReason): void {
    if (this.request?.ownerId !== ownerId) {
      return
    }
    this.reasons.delete(reason)
    if (this.reasons.size) {
      return
    }
    this.clearOpen()
    const delay = resolvePolicy(this.defaults, this.request.policy).closeDelay
    const generation = ++this.generation
    if (delay === 0) {
      this.hide()
    }
    else {
      this.closeTimer = setTimeout(() => {
        if (generation === this.generation && this.reasons.size === 0) {
          this.hide()
        }
      }, delay)
    }
  }

  public close(ownerId?: string): void {
    if (ownerId && this.request?.ownerId !== ownerId) {
      return
    }
    this.reasons.clear()
    this.hide()
  }

  public dispose(): void {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.disposeKeyboardWatch()
    this.reasons.clear()
    this.hide()
  }

  private show(generation: number, policy: EndgeTooltipConfiguration): void {
    this.openTimer = null
    const request = this.request
    if (this.disposed || generation !== this.generation || !request || !this.reasons.size || !request.anchor.isConnected || !this.matchesKeyboard(policy)) {
      this.hide()
      return
    }
    Object.assign(this.state, {
      phase: 'visible',
      ownerId: request.ownerId,
      domId: request.domId,
      anchor: request.anchor,
      kind: request.kind,
      policy,
      className: request.className ?? null,
      authoredId: request.authoredId ?? null,
      part: request.part ?? null,
      content: request.renderContent(),
    })
    updateDescribedBy(request.anchor, request.domId, true)
  }

  private hide(): void {
    this.suspend()
    this.request = null
  }

  private suspend(): void {
    this.clearOpen()
    this.clearClose()
    this.generation += 1
    if (this.state.anchor && this.state.domId) {
      updateDescribedBy(this.state.anchor, this.state.domId, false)
    }
    Object.assign(this.state, {
      phase: 'idle',
      ownerId: null,
      domId: null,
      anchor: null,
      className: null,
      authoredId: null,
      part: null,
      content: null,
    })
  }

  private reconcileActivation(): void {
    const request = this.request
    if (this.disposed || !request || !this.reasons.size || !request.anchor.isConnected) {
      return
    }
    const policy = resolvePolicy(this.defaults, request.policy)
    if (!this.matchesKeyboard(policy)) {
      this.suspend()
      return
    }
    if ((this.state.phase === 'visible' || this.state.phase === 'pending') && this.state.ownerId === request.ownerId) {
      return
    }
    this.clearOpen()
    this.state.phase = 'pending'
    this.state.ownerId = request.ownerId
    const generation = ++this.generation
    if (policy.openDelay === 0) {
      this.show(generation, policy)
    }
    else { this.openTimer = setTimeout(() => this.show(generation, policy), policy.openDelay) }
  }

  private matchesKeyboard(policy: EndgeTooltipConfiguration): boolean {
    const keyboard = Endge.context.getKeyboardState()
    return matchesComponentSFCInteractionKeyboardCondition(policy.keyboard, keyboard, keyboard.platform)
  }

  private clearOpen(): void {
    if (this.openTimer != null) {
      clearTimeout(this.openTimer)
    }
    this.openTimer = null
  }

  private clearClose(): void {
    if (this.closeTimer != null) {
      clearTimeout(this.closeTimer)
    }
    this.closeTimer = null
  }
}

export const ShadcnTooltipManagerKey: InjectionKey<ShadcnTooltipManager> = Symbol('ShadcnTooltipManager')

export function attachShadcnTooltipAttrs(
  attrs: Record<string, unknown>,
  manager: ShadcnTooltipManager | null,
  createRequest: (anchor: HTMLElement) => ShadcnTooltipRequest,
): void {
  if (!manager) {
    return
  }
  let ownerId = ''
  append(attrs, 'onMouseenter', (event: MouseEvent) => {
    const request = createRequest(event.currentTarget as HTMLElement)
    ownerId = request.ownerId
    manager.activate(request, 'pointer')
  })
  append(attrs, 'onMouseleave', () => ownerId && manager.deactivate(ownerId, 'pointer'))
  append(attrs, 'onFocusin', (event: FocusEvent) => {
    const request = createRequest(event.currentTarget as HTMLElement)
    ownerId = request.ownerId
    manager.activate(request, 'focus')
  })
  append(attrs, 'onFocusout', () => ownerId && manager.deactivate(ownerId, 'focus'))
  append(attrs, 'onKeydown', (event: KeyboardEvent) => {
    if (event.key === 'Escape' && ownerId) {
      manager.close(ownerId)
    }
  })
  append(attrs, 'onVnodeUnmounted', () => ownerId && manager.close(ownerId))
  attrs['data-endge-tooltip-trigger'] = ''
}

function append(attrs: Record<string, unknown>, name: string, handler: (event: any) => void): void {
  attrs[name] = attrs[name] ? [attrs[name], handler] : handler
}

function resolvePolicy(defaults: EndgeTooltipConfiguration, local?: Partial<EndgeTooltipConfiguration>): EndgeTooltipConfiguration {
  const next: any = { ...defaults }
  for (const [key, value] of Object.entries(local ?? {})) {
    if (value != null) {
      next[key] = value
    }
  }
  next.side = ['top', 'right', 'bottom', 'left'].includes(String(next.side)) ? next.side : defaults.side
  next.align = ['start', 'center', 'end'].includes(String(next.align)) ? next.align : defaults.align
  for (const key of ['openDelay', 'closeDelay']) {
    const value = Number(next[key])
    const fallback = key === 'openDelay' ? defaults.openDelay : defaults.closeDelay
    next[key] = Number.isFinite(value) && value >= 0 ? Math.min(60_000, Math.round(value)) : fallback
  }
  const keyboard = normalizeComponentSFCInteractionKeyboardCondition(next.keyboard)
  if (keyboard) {
    next.keyboard = keyboard
  }
  else { delete next.keyboard }
  return next
}

function updateDescribedBy(anchor: HTMLElement, id: string, add: boolean): void {
  const ids = new Set((anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean))
  if (add) {
    ids.add(id)
  }
  else { ids.delete(id) }
  if (ids.size) {
    anchor.setAttribute('aria-describedby', [...ids].join(' '))
  }
  else { anchor.removeAttribute('aria-describedby') }
}
