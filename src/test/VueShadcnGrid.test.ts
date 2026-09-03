import { Endge } from '@endge/core'
import { describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-shadcn-render.type'
import { VueShadcnRender_Grid } from '@/services/render/sfc/vue-shadcn-renderers'
import { VueShadcnSFCAdapter } from '@/services/render/sfc/vue-shadcn-sfc-adapter'

describe('vueShadcnRender_Grid', () => {
  it('completes the required adapter contract', () => {
    expect(Object.keys(VueShadcnSFCAdapter.renderers))
      .toEqual(SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS)
    Endge.uiRegistry.adapters.reset()
    expect(() => Endge.uiRegistry.adapters.register(VueShadcnSFCAdapter)).not.toThrow()
    Endge.uiRegistry.adapters.reset()
  })

  it('renders Grid tracks and spacing', () => {
    const grid = VueShadcnRender_Grid({
      h,
      props: { columns: 12, gap: 2, autoRows: '28px' },
      attrs: {},
      children: [],
    })

    expect(isVNode(grid)).toBe(true)
    if (!isVNode(grid)) {
      return
    }
    expect(grid.props?.class).toContain('endge-shadcn-grid')
    expect(grid.props?.style).toMatchObject({
      display: 'grid',
      gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
      gridAutoRows: '28px',
      gap: '8px',
    })
  })
})
