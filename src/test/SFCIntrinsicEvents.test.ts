import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, isVNode } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-shadcn-render.type'
import { VueShadcnSFCAdapter } from '@/services/render/sfc/vue-shadcn-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('sFC intrinsic Events in shadcn renderer', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.uiRegistry.adapters.register(VueShadcnSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: VueShadcnSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue-shadcn',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  afterEach(() => Endge.uiRegistry.adapters.reset())

  it('routes a Text click through the same renderer-neutral boundary', () => {
    const boundary = {
      observesChild: vi.fn(() => false),
      routeChild: vi.fn(async () => undefined),
    }
    const context = createSFCVueRenderContext({})
    context.eventBoundary = boundary as any
    const node: RComponentSFC_IR_ElementNode = {
      id: 'title',
      kind: 'element',
      tag: 'Text',
      props: { ref: { kind: 'literal', value: 'title' } },
      directives: {},
      events: [{
        name: 'click',
        modifiers: ['stop'],
        action: { kind: 'action', identity: 'flight.open-details', input: { kind: 'event', path: null } },
      }],
      children: [],
    }
    const rendered = renderSFCNode(h, node, context)
    if (!isVNode(rendered)) {
      throw new Error('Text did not render a VNode')
    }
    const stopPropagation = vi.fn()
    const currentTarget = { id: 'title' }

    rendered.props?.onClick({
      type: 'click',
      target: currentTarget,
      currentTarget,
      cancelable: true,
      preventDefault: vi.fn(),
      stopPropagation,
      clientX: 4,
      clientY: 8,
      button: 0,
      buttons: 1,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })

    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(boundary.routeChild).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'title', ref: 'title', componentTag: 'Text' }),
      'click',
      expect.objectContaining({ type: 'click', x: 4, y: 8, button: 0 }),
      node.events,
      [],
      0,
      {},
    )
  })
})
