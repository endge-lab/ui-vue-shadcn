import type { ComponentSFCRenderPort } from '@endge/core'
import { Endge } from '@endge/core'
import { Raph } from '@endge/raph'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EndgeVueShadcn_Module } from '@/modules/EndgeVueShadcn_Module'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'

describe('пассивный renderer debugger', () => {
  afterEach(() => vi.restoreAllMocks())

  /** UI lifecycle не регистрирует вычислительные фазы и освобождает наблюдение при reset. */
  it('подписывается на снимки без запуска Raph и очищает подписки', () => {
    vi.spyOn(Endge, 'mode', 'get').mockReturnValue('debugger')
    const addPhase = vi.spyOn(Raph, 'addPhase')
    const off = [vi.fn(), vi.fn(), vi.fn()]
    vi.spyOn(Endge.configuration, 'subscribe').mockReturnValue(off[0]!)
    vi.spyOn(Endge.runtime, 'subscribe').mockReturnValue(off[1]!)
    vi.spyOn(Endge.uiRegistry, 'subscribe').mockReturnValue(off[2]!)
    const module = new EndgeVueShadcn_Module()
    module.start()
    module.start()
    expect(addPhase).not.toHaveBeenCalled()
    module.reset()
    for (const cleanup of off) {
      expect(cleanup).toHaveBeenCalledTimes(1)
    }
  })

  /** Снимок предоставляет scope/style values и не обращается к живому Runtime. */
  it('строит context без event boundary и поиска исполняемого host', () => {
    const lookup = vi.spyOn(Endge.runtime, 'getRuntimeScopeByHost')
    const host = { id: 'observed', entityIdentity: 'table', readonly: true, runtimeScopeIds: ['client-scope'], styleArtifacts: [], getArtifact: () => null } as unknown as ComponentSFCRenderPort
    const context = createSFCVueRenderContext({ count: 4 }, 0, host)
    expect(context.runtimeScopeIds).toEqual(['client-scope'])
    expect(context.eventBoundary).toBeNull()
    expect(context.props.count).toBe(4)
    expect(lookup).not.toHaveBeenCalled()
  })
})
