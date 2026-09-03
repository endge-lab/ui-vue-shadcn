import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import { SFCRenderInspectionSession } from '@endge/core'
import { describe, expect, it } from 'vitest'

import { registerSFCInspectionElement, registerSFCInspectionRoot } from '@/services/render/sfc/SFCVueRenderInspection'
import { createSFCVueRenderContext, extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'

describe('sFCVueRenderInspection', () => {
  it('registers concrete table-cell data under a stable row-key scope', () => {
    const session = new SFCRenderInspectionSession()
    const context = createSFCVueRenderContext(
      { rows: [{ id: 'SU-100', status: 'boarding' }] },
      0,
      null,
      null,
      ['flight-table'],
      'root',
      undefined,
      undefined,
      session,
    )
    context.inspectionParentId = registerSFCInspectionRoot(context)
    const cellContext = extendSFCVueRenderContext(context, {
      row: { id: 'SU-100', status: 'boarding' },
      rowIndex: 0,
      rowKey: 'SU-100',
      columnKey: 'status',
      value: 'boarding',
    }, null, 'root/table:table/row:SU-100/column:status')
    const id = registerSFCInspectionElement(element('status-badge', 'Badge'), { value: 'boarding' }, cellContext)

    expect(session.getNode(id!)).toMatchObject({
      scope: 'root/table:table/row:SU-100/column:status',
      locals: { rowKey: 'SU-100', columnKey: 'status', value: 'boarding' },
    })
  })
})

function element(id: string, tag: RComponentSFC_IR_ElementNode['tag']): RComponentSFC_IR_ElementNode {
  return {
    id,
    kind: 'element',
    tag,
    props: {},
    directives: {},
    children: [],
  }
}
