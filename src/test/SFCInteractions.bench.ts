import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import { bench, describe } from 'vitest'

import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { attachSFCInteractionAttrs } from '@/ui/render/sfc/SFCRender_Interaction'

const node: RComponentSFC_IR_ElementNode = {
  id: 'bench', kind: 'element', tag: 'Text', props: {}, directives: {}, children: [],
  interactions: [{ rules: [{
    event: 'click',
    trigger: { kind: 'literal', value: { event: 'click', button: 0 } },
    modifiers: [],
    listener: { capture: false, passive: false },
    reactions: [{ kind: 'action', identity: 'bench.click' }],
  }] }],
}
const context = createSFCVueRenderContext({})
context.eventBoundary = {
  observesChild: () => false,
  claimLocalOnce: () => true,
  routeChild: async () => undefined,
} as any

describe('Shadcn Vue SFC interaction bridge benchmarks', () => {
  bench('attach listeners to 10k visual nodes', () => {
    for (let index = 0; index < 10_000; index++)
      attachSFCInteractionAttrs({}, { ...node, id: `node-${index}` }, {}, context)
  }, { iterations: 10 })

  const listeners = Array.from({ length: 10_000 }, (_item, index) => {
    const attrs: Record<string, unknown> = {}
    attachSFCInteractionAttrs(attrs, { ...node, id: `dispatch-${index}` }, {}, context)
    return attrs.onClick as (event: Event) => void
  })
  bench('dispatch across 10k visual-node listeners', () => {
    for (const listener of listeners) listener({
      type: 'click', target: null, currentTarget: null, cancelable: true, button: 0,
      preventDefault() {}, stopPropagation() {},
    } as unknown as Event)
  }, { iterations: 10 })
})
