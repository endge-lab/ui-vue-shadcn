import { describe, expect, it, vi } from 'vitest'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCExpression } from '@/ui/render/sfc/SFCRender_Evaluator'

describe('$data.metaOf in Vue Shadcn renderer', () => {
  it('передаёт compiler-known row reference в Component host', () => {
    const readDataMeta = vi.fn().mockReturnValue({ status: 'waiting' })
    const context = createSFCVueRenderContext({}, 0, {
      id: 'host-1',
      entityIdentity: 'meta-owner',
      getArtifact: () => null,
      readDataMeta,
    } as any)
    context.locals.row = { id: 7, flightCarrier: 'SU' }
    context.dataScope = { kind: 'table-row', boundaryId: 'table-1', rowKey: 7 }

    expect(evaluateSFCExpression('$data.metaOf(row.flightCarrier, \'aodb.optimistic\')', context)).toEqual({ status: 'waiting' })
    expect(readDataMeta).toHaveBeenCalledWith({
      kind: 'table-row',
      path: ['flightCarrier'],
      boundaryId: 'table-1',
      rowKey: 7,
    }, 'aodb.optimistic')
  })
})
