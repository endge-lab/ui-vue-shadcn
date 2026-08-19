<script setup lang="ts">
import type { EndgeTooltipAlign, EndgeTooltipSide } from '@endge/core'
import { computed, defineComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { ShadcnTooltipManager } from './shadcn-tooltip-manager'

const props = defineProps<{ manager: ShadcnTooltipManager }>()
const state = props.manager.state
const root = ref<HTMLElement | null>(null)
const style = ref({ left: '-10000px', top: '-10000px' })
const actualSide = ref<EndgeTooltipSide>('right')
let observer: ResizeObserver | null = null

const classes = computed(() => [
  'endge-tooltip', 'endge-tooltip--vue-shadcn', `endge-tooltip--${state.kind}`, state.className,
])
const ContentRenderer = defineComponent({ setup: () => () => state.content as any })

watch(() => state.phase, async (phase) => {
  cleanup()
  if (phase !== 'visible') return
  await nextTick()
  position()
  window.addEventListener('resize', position, { passive: true })
  window.addEventListener('scroll', position, { passive: true, capture: true })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(position)
    if (state.anchor) observer.observe(state.anchor)
    if (root.value) observer.observe(root.value)
  }
}, { flush: 'post' })

onBeforeUnmount(cleanup)

function cleanup(): void {
  window.removeEventListener('resize', position)
  window.removeEventListener('scroll', position, true)
  observer?.disconnect()
  observer = null
}

function position(): void {
  const anchor = state.anchor
  const content = root.value
  if (!anchor?.isConnected || !content) {
    if (state.phase === 'visible') props.manager.close(state.ownerId ?? undefined)
    return
  }
  const anchorRect = anchor.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const sides = sideOrder(state.policy.side)
  const candidates = sides.map(side => candidate(side, state.policy.align, anchorRect, contentRect))
  const selected = candidates.reduce((best, item) => score(item, contentRect) < score(best, contentRect) ? item : best)
  actualSide.value = selected.side
  style.value = {
    left: `${clamp(selected.left, 6, window.innerWidth - contentRect.width - 6)}px`,
    top: `${clamp(selected.top, 6, window.innerHeight - contentRect.height - 6)}px`,
  }
}

function sideOrder(preferred: EndgeTooltipSide): EndgeTooltipSide[] {
  const opposite = ({ top: 'bottom', right: 'left', bottom: 'top', left: 'right' } as const)[preferred]
  return [preferred, opposite, ...(['top', 'right', 'bottom', 'left'] as EndgeTooltipSide[]).filter(item => item !== preferred && item !== opposite)]
}

function candidate(side: EndgeTooltipSide, align: EndgeTooltipAlign, anchor: DOMRect, content: DOMRect) {
  const horizontal = side === 'top' || side === 'bottom'
  const start = horizontal ? anchor.left : anchor.top
  const size = horizontal ? anchor.width : anchor.height
  const contentSize = horizontal ? content.width : content.height
  const cross = align === 'start' ? start : align === 'end' ? start + size - contentSize : start + (size - contentSize) / 2
  if (side === 'top') return { side, left: cross, top: anchor.top - content.height - 7 }
  if (side === 'bottom') return { side, left: cross, top: anchor.bottom + 7 }
  if (side === 'left') return { side, left: anchor.left - content.width - 7, top: cross }
  return { side, left: anchor.right + 7, top: cross }
}

function score(value: { left: number, top: number }, content: DOMRect): number {
  return Math.max(0, 6 - value.left) + Math.max(0, 6 - value.top)
    + Math.max(0, value.left + content.width + 6 - window.innerWidth)
    + Math.max(0, value.top + content.height + 6 - window.innerHeight)
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.phase === 'visible'"
      :id="state.domId ?? undefined"
      ref="root"
      role="tooltip"
      data-slot="endge-tooltip-content"
      data-endge-tooltip=""
      data-endge-tooltip-adapter="vue-shadcn"
      :data-endge-tooltip-id="state.authoredId ?? undefined"
      :data-side="actualSide"
      :data-align="state.policy.align"
      :part="state.part ?? undefined"
      :class="classes"
      :style="style"
    >
      <ContentRenderer />
    </div>
  </Teleport>
</template>

<style>
.endge-tooltip.endge-tooltip--vue-shadcn {
  position: fixed;
  z-index: var(--endge-tooltip-z-index, 10060);
  width: max-content;
  max-width: min(var(--endge-tooltip-max-width, 320px), calc(100vw - 12px));
  padding: var(--endge-tooltip-padding, 6px 9px);
  border: var(--endge-tooltip-border, 1px solid hsl(var(--border, 214 32% 91%) / 0.3));
  border-radius: var(--endge-tooltip-radius, 6px);
  background: var(--endge-tooltip-background, hsl(var(--foreground, 222 47% 11%)));
  color: var(--endge-tooltip-color, hsl(var(--background, 0 0% 100%)));
  box-shadow: var(--endge-tooltip-shadow, 0 8px 24px rgb(0 0 0 / 0.2));
  font-size: var(--endge-tooltip-font-size, 12px);
  line-height: var(--endge-tooltip-line-height, 1.4);
  overflow-wrap: anywhere;
  pointer-events: none;
}
.endge-tooltip--vue-shadcn p { margin: 0.35em 0; }
.endge-tooltip--vue-shadcn ul,
.endge-tooltip--vue-shadcn ol { margin: 0.35em 0; padding-left: 1.25em; }
.endge-tooltip--vue-shadcn pre { margin: 0.4em 0; white-space: pre-wrap; }
</style>
