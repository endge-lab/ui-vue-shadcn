import type {
  EndgeDiagnosticsConfiguration,
  EndgeWorkspaceDefinition,
  FilterViewRuntimeHost,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Tag,
  RComponentSFC_IR_Value,
} from '@endge/core'
import type { Component, VNode } from 'vue'
import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, h, isVNode, nextTick } from 'vue'

import { EndgeVueShadcnModule } from '@/model/kernel/endge-vue-shadcn'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/model/render/sfc/sfc-shadcn-render.type'
import {
  VUE_SHADCN_SFC_ADAPTER_ID,
  VueShadcnSFCAdapter,
} from '@/model/render/sfc/vue-shadcn-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

const TEST_WORKSPACE: EndgeWorkspaceDefinition = {
  identity: 'workspace-test',
  displayName: 'Test Workspace',
  dataMode: 'live',
  managedBy: 'user',
  managedById: null,
  installedIntegrations: [],
  configuration: {
    vars: [],
    values: {},
    locales: [{ code: 'en', displayName: 'English', shortLabel: 'EN', direction: 'ltr' }],
    defaultLocale: 'en',
    fallbackLocale: 'en',
    themes: [
      { identity: 'light', displayName: 'Light' },
      { identity: 'dark', displayName: 'Dark' },
    ],
    defaultTheme: 'light',
    timezones: [
      { identity: 'local', displayName: 'Local time' },
      { identity: 'UTC', displayName: 'UTC' },
    ],
    defaultTimezone: 'local',
    defaultAuthProfileIdentity: null,
    sfcAdapterIds: ['vue-native', 'vue-shadcn'],
    defaultSfcAdapterId: 'vue-shadcn',
    sfcEditing: {
      cancelOn: [
        { event: 'keydown', key: ['Escape'], prevent: true, stop: true },
        { event: 'focusout' },
      ],
      commitOn: [
        { event: 'keydown', key: ['Enter'], prevent: true },
      ],
    },
    tooltips: { side: 'right', align: 'start', openDelay: 250, closeDelay: 100 },
    diagnostics: createDiagnosticsConfiguration(),
  },
}

describe('vueShadcnSFCAdapter', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
    new EndgeVueShadcnModule().setup()
    Endge.uiRegistry.adapters.activate({
      id: VUE_SHADCN_SFC_ADAPTER_ID,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue-shadcn',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
      requiredRootKeys: ['shell', 'sfc', 'sfc-runtime', 'filter-view'],
    })
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  it('registers the complete Vue adapter contract', () => {
    expect(Endge.uiRegistry.adapters.active?.id).toBe('vue-shadcn')
    expect(Object.keys(VueShadcnSFCAdapter.renderers)).toEqual(SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS)
    expect(Object.keys(VueShadcnSFCAdapter.roots)).toEqual(['shell', 'sfc', 'sfc-runtime', 'filter-view'])
  })

  it('maps the neutral background tone used by GroundHandlingProcess', () => {
    const node: RComponentSFC_IR_ElementNode = {
      id: 'test-neutral-flex',
      kind: 'element',
      tag: 'Flex',
      props: {
        backgroundTone: literal('neutral'),
      },
      directives: {},
      children: [],
    }
    const result = renderSFCNode(h, node, createSFCVueRenderContext({}))
    if (!isVNode(result)) {
      throw new Error('Flex did not render a VNode')
    }

    expect(result.props?.style).toMatchObject({
      background: 'var(--endge-tone-neutral-background, #e5e7eb)',
    })
  })

  it.each([
    ['String', 'text', 'SU 1402'],
    ['Number', 'number', '15'],
    ['Date', 'date', '2026-07-13'],
    ['Time', 'time', '12:34'],
    ['DateTime', 'datetime-local', '2026-07-13T10:20'],
  ])('renders %s through the shadcn input primitive', async (type, nativeType, expectedValue) => {
    const sourceValue = type === 'Date'
      ? '2026-07-13T00:00:00.000Z'
      : type === 'Time'
        ? '12:34:56'
        : type === 'DateTime'
          ? '2026-07-13T10:20'
          : expectedValue
    const mounted = await mountControl('Input', { type, value: sourceValue })
    const input = mounted.root.querySelector('input')

    expect(input?.type).toBe(nativeType)
    expect(input?.value).toBe(expectedValue)
    expect(input?.classList.contains('endge-shadcn-input')).toBe(true)
    mounted.unmount()
  })

  it('renders textarea, checkbox and single/multiple select values', async () => {
    const textarea = await mountControl('Textarea', {
      value: 'Комментарий',
      rows: 4,
    })
    expect(textarea.root.querySelector('textarea')?.value).toBe('Комментарий')
    textarea.unmount()

    const checkbox = await mountControl('Checkbox', {
      checked: true,
      label: 'Отменённые',
    })
    expect(checkbox.root.querySelector('input')?.checked).toBe(true)
    expect(checkbox.root.textContent).toContain('Отменённые')
    checkbox.unmount()

    const options = [
      { value: 1, label: 'Один' },
      { value: 2, label: 'Два' },
      { value: true, label: 'Да' },
    ]
    const single = await mountControl('Select', { value: '2', options })
    expect(selectedOptions(single.root)).toEqual(['2'])
    single.unmount()

    const multiple = await mountControl('Select', {
      multiple: true,
      value: ['1', true],
      options,
    })
    expect(selectedOptions(multiple.root)).toEqual(['1', 'true'])
    expect(multiple.root.querySelector('.endge-shadcn-multiselect-content')).toBeNull()

    const trigger = multiple.root.querySelector('.endge-shadcn-multiselect-trigger') as HTMLButtonElement
    trigger.click()
    await nextTick()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(multiple.root.querySelector('.endge-shadcn-multiselect-content')).not.toBeNull()
    expect(multiple.root.querySelectorAll('.endge-shadcn-multiselect-option')).toHaveLength(options.length)
    expect(multiple.root.querySelectorAll('.endge-shadcn-multiselect-option[aria-selected="true"]')).toHaveLength(2)
    multiple.unmount()
  })

  it('does not expose runtime update callbacks from adapter renderers', () => {
    const controls: Array<[Extract<RComponentSFC_IR_Tag, 'Input' | 'Textarea' | 'Checkbox' | 'Select'>, Record<string, unknown>]> = [
      ['Input', { value: 'SU' }],
      ['Textarea', { value: 'Комментарий' }],
      ['Checkbox', { checked: true }],
      ['Select', { value: 'active', options: [{ value: 'active' }] }],
    ]

    for (const [tag, props] of controls) {
      const vnode = renderControl(tag, props)
      expect(Object.keys(vnode.props ?? {}).filter(key => key.startsWith('on'))).toEqual([])
    }
  })

  it('owns workspace activation without the Native Vue module', () => {
    Endge.uiRegistry.adapters.reset()
    const module = new EndgeVueShadcnModule()
    module.setup()
    module.build()
    module.start()

    expect(Endge.uiRegistry.adapters.active?.id).toBe('vue-shadcn')
    expect(Endge.uiRegistry.adapters.active?.renderer).toBe('vue-shadcn')
    expect(Endge.uiRegistry.adapters.active?.roots?.shell).toBeTruthy()
    module.reset()
  })

  it('renders generated filter views through its own adapter root', async () => {
    const runtime = {
      getRenderModel: () => ({
        implementation: { kind: 'generated' as const },
        props: {},
        fields: [{
          key: 'search',
          type: 'String' as const,
          optional: true,
          array: false,
          control: { type: 'Input' as const },
          value: 'SU 1402',
          options: [],
        }],
      }),
      on: () => undefined,
      off: () => undefined,
      setValue: async () => undefined,
    } as unknown as FilterViewRuntimeHost
    const root = document.createElement('div')
    const component = VueShadcnSFCAdapter.roots['filter-view'] as Component
    const app = createApp({ render: () => h(component, { runtime }) })

    app.mount(root)
    await nextTick()

    expect(root.querySelector('input')?.value).toBe('SU 1402')
    expect(root.querySelector('.endge-shadcn-filter-renderer')).not.toBeNull()
    app.unmount()
  })
})

function renderControl(
  tag: Extract<RComponentSFC_IR_Tag, 'Input' | 'Textarea' | 'Checkbox' | 'Select'>,
  props: Record<string, unknown>,
): VNode {
  const node: RComponentSFC_IR_ElementNode = {
    id: `test-${tag}`,
    kind: 'element',
    tag,
    props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, literal(value)])),
    directives: {},
    children: [],
  }
  const result = renderSFCNode(h, node, createSFCVueRenderContext({}))
  if (!isVNode(result)) {
    throw new Error(`${tag} did not render a VNode`)
  }
  return result
}

async function mountControl(
  tag: Extract<RComponentSFC_IR_Tag, 'Input' | 'Textarea' | 'Checkbox' | 'Select'>,
  props: Record<string, unknown>,
): Promise<{ root: HTMLDivElement, unmount: () => void }> {
  const vnode = renderControl(tag, props)
  const root = document.createElement('div')
  const app = createApp({ render: () => vnode })
  app.mount(root)
  await nextTick()

  return {
    root,
    unmount: () => app.unmount(),
  }
}

function selectedOptions(root: HTMLElement): string[] {
  const select = root.querySelector('select')
  return select ? [...select.selectedOptions].map(option => option.value) : []
}

function literal(value: unknown): RComponentSFC_IR_Value {
  return { kind: 'literal', value }
}

function createDiagnosticsConfiguration(): EndgeDiagnosticsConfiguration {
  return {
    telemetry: {
      collection: {
        enabled: false,
        signals: ['log' as const],
        minSeverity: 9,
        maxRecords: 2_000,
      },
      outputs: [],
      routes: [],
    },
    snapshots: {
      content: { telemetry: true, problems: true, configuration: false },
      automatic: {
        enabled: false,
        errorCount: 10,
        windowSeconds: 60,
        cooldownSeconds: 300,
        outputIds: [],
      },
    },
  }
}
