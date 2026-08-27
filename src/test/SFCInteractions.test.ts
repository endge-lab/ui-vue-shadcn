// @vitest-environment jsdom

import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import {
  compileComponentSFC,
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, isVNode } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/model/render/sfc/sfc-shadcn-render.type'
import { VueShadcnSFCAdapter } from '@/model/render/sfc/vue-shadcn-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { createSFCSemanticInteractionBindings } from '@/ui/render/sfc/SFCRender_Interaction'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('sFC :on interactions in Shadcn Vue renderer', () => {
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

  it('compiles Source, selects the first matching rule and routes ordered reactions', async () => {
    const node = compileText(`<Text value="Open" :on.stop.prevent.self.once="[
      { event: 'click', button: 1, reaction: action({ identity: 'wrong' }) },
      { event: 'click', button: 0, held: { code: ['KeyW'], exact: true }, modifiers: { shift: true }, reaction: [action({ identity: 'first' }), action({ identity: 'second' })] },
    ]" />`)
    const boundary = {
      observesChild: vi.fn(() => false),
      claimLocalOnce: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
      routeChild: vi.fn(async () => undefined),
    }
    const context = createSFCVueRenderContext({})
    context.locals = { rowId: 'row-7', columnKey: 'status', row: { id: 'row-7' } }
    context.eventBoundary = boundary as any
    const rendered = renderSFCNode(h, node, context)
    if (!isVNode(rendered)) {
      throw new Error('Text did not render a VNode')
    }

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }))
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const currentTarget = { id: 'title' }
    rendered.props?.onClick({
      type: 'click',
      target: { id: 'child' },
      currentTarget,
      cancelable: true,
      preventDefault,
      stopPropagation,
      button: 0,
      buttons: 1,
      clientX: 1,
      clientY: 1,
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    })
    expect(boundary.routeChild).not.toHaveBeenCalled()
    rendered.props?.onClick({
      type: 'click',
      target: currentTarget,
      currentTarget,
      cancelable: true,
      preventDefault,
      stopPropagation,
      button: 0,
      buttons: 1,
      clientX: 3,
      clientY: 7,
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    })
    rendered.props?.onClick({
      type: 'click',
      target: currentTarget,
      currentTarget,
      cancelable: true,
      preventDefault,
      stopPropagation,
      button: 0,
      buttons: 1,
      clientX: 3,
      clientY: 7,
      shiftKey: true,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    })
    await Promise.resolve()

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(boundary.claimLocalOnce).toHaveBeenCalledTimes(2)
    expect(boundary.routeChild).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: node.id }),
      'click',
      expect.objectContaining({
        x: 3,
        held: expect.objectContaining({ code: ['KeyW'] }),
        modifiers: expect.objectContaining({ shift: true }),
      }),
      [expect.objectContaining({
        actions: [
          expect.objectContaining({ identity: 'first' }),
          expect.objectContaining({ identity: 'second' }),
        ],
      })],
      [],
      0,
      { rowId: 'row-7', columnKey: 'status', row: { id: 'row-7' } },
    )
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }))
  })

  it('uses capture/passive VNode options and keeps :on independent from editable', () => {
    const node = compileText(`<Text value="Open" editable edit-on="click" :on.capture.passive="{ event: 'click', reaction: action({ identity: 'audit' }) }" />`)
    const boundary = {
      observesChild: vi.fn(() => false),
      claimLocalOnce: vi.fn(() => true),
      routeChild: vi.fn(async () => undefined),
    }
    const host = {
      getEditSession: vi.fn(() => null),
      beginEditSession: vi.fn(),
    }
    const context = createSFCVueRenderContext({})
    context.eventBoundary = boundary as any
    context.host = host as any
    const rendered = renderSFCNode(h, node, context)
    if (!isVNode(rendered)) {
      throw new Error('Text did not render a VNode')
    }

    expect(rendered.props?.onClickCapturePassive).toBeTypeOf('function')
    expect(rendered.props?.onClick).toBeTypeOf('function')
    const currentTarget = { id: 'title' }
    rendered.props?.onClickCapturePassive({
      type: 'click',
      target: currentTarget,
      currentTarget,
      cancelable: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      button: 0,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    })
    rendered.props?.onClick({
      type: 'click',
      target: currentTarget,
      currentTarget,
      cancelable: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      button: 0,
      shiftKey: false,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
    })
    expect(boundary.routeChild).toHaveBeenCalledOnce()
    expect(host.beginEditSession).toHaveBeenCalledOnce()
  })

  it('projects nested component :on rules to the semantic Event boundary', () => {
    const node: RComponentSFC_IR_ElementNode = {
      id: 'child',
      kind: 'element',
      tag: 'Component',
      props: {},
      directives: {},
      children: [],
      interactions: [{ rules: [{
        event: 'saved',
        trigger: { kind: 'literal', value: { event: 'saved', once: true } },
        modifiers: ['stop'],
        listener: { capture: false, passive: false },
        reactions: [{ kind: 'action', identity: 'audit.saved' }],
      }] }],
    }
    expect(createSFCSemanticInteractionBindings(node, createSFCVueRenderContext({}))).toEqual([
      expect.objectContaining({
        name: 'saved',
        modifiers: ['stop', 'once'],
        actions: [expect.objectContaining({ identity: 'audit.saved' })],
      }),
    ])
  })

  it('attaches Cell interactions to the table cell surface with row and column locals', async () => {
    const result = compileComponentSFC(`<template><Table :rows="rows" row-key="id"><Column key="status"><Cell :on="{ event: 'click', modifiers: { shift: true }, held: { code: ['KeyW'] }, reaction: action({ identity: 'cell.inspect' }) }"><Text>{{ value }}</Text></Cell></Column></Table></template>`)
    const node = result.ir?.template?.roots[0]
    if (!node || node.kind !== 'element') {
      throw new Error(JSON.stringify(result.diagnostics))
    }
    const boundary = {
      observesChild: vi.fn(() => false),
      claimLocalOnce: vi.fn(() => true),
      routeChild: vi.fn(async () => undefined),
    }
    const context = createSFCVueRenderContext({ rows: [{ id: 7, status: 'ready' }] })
    context.eventBoundary = boundary as any
    const rendered = renderSFCNode(h, node, context)
    if (!isVNode(rendered)) {
      throw new Error('Table did not render a VNode')
    }
    const table = (rendered.children as any[])[0]
    const column = table.props.columns[0]
    const cell = table.props.renderCell(column, { id: 7, status: 'ready' }, 0, '7')
    if (!isVNode(cell)) {
      throw new Error('Cell did not render a VNode')
    }

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', bubbles: true }))
    cell.props?.onClick(new MouseEvent('click', { bubbles: true, shiftKey: true, button: 0 }))
    await Promise.resolve()

    expect(boundary.routeChild).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: column.cellNode.id, componentTag: 'Cell' }),
      'click',
      expect.any(Object),
      expect.any(Array),
      [],
      0,
      expect.objectContaining({ row: { id: 7, status: 'ready' }, rowKey: 7, columnKey: 'status', value: 'ready' }),
    )
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', code: 'KeyW', bubbles: true }))
  })
})

function compileText(template: string): RComponentSFC_IR_ElementNode {
  const result = compileComponentSFC(`<template>${template}</template>`)
  const errors = result.diagnostics.filter(item => item.severity === 'error')
  if (errors.length) {
    throw new Error(JSON.stringify(errors))
  }
  const node = result.ir?.template?.roots[0]
  if (!node || node.kind !== 'element') {
    throw new Error('Text root was not compiled')
  }
  return node
}
