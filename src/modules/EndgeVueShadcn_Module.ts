import type { EndgeBootContext, EndgePlugin, EndgeStylePlacement } from '@endge/core'
import {
  Endge,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,

  EndgeModule,

} from '@endge/core'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/services/render/sfc/sfc-shadcn-render.type'
import { VueShadcnSFCAdapter } from '@/services/render/sfc/vue-shadcn-sfc-adapter'
import { EndgeDOMStyleRuntime } from '@/services/style/EndgeDOMStyleRuntime'

/** Регистрирует системный vue-shadcn adapter в общем UI registry. */
export class EndgeVueShadcn_Module extends EndgeModule {
  private _started = false
  private _adapterFallbackIds: readonly string[] = []
  private _unsubscribeWorkspace: (() => void) | null = null
  private _unsubscribeStyles: (() => void) | null = null
  private _unsubscribeProgram: (() => void) | null = null
  private _unsubscribeUIRegistry: (() => void) | null = null
  private _unsubscribeRuntimeScopes: (() => void) | null = null
  private readonly _styleRuntime = new EndgeDOMStyleRuntime()

  public override setup(ctx?: EndgeBootContext): void {
    this._adapterFallbackIds = ctx?.ui?.adapterFallbackIds ?? []
    Endge.uiRegistry.adapters.register(VueShadcnSFCAdapter)
  }

  public override build(): void {
    this._activateWorkspaceAdapter()
  }

  public override start(): void {
    if (this._started) {
      return
    }
    this._started = true
    this._unsubscribeWorkspace = Endge.workspace.subscribe(() => {
      this._activateWorkspaceAdapter()
      this._refreshStyles()
    })
    this._unsubscribeStyles = Endge.styles.subscribe(() => this._refreshStyles())
    this._unsubscribeProgram = Endge.program.subscribe(() => this._refreshStyles())
    this._unsubscribeUIRegistry = Endge.uiRegistry.subscribe(() => this._refreshStyles())
    this._unsubscribeRuntimeScopes = Endge.runtime.scopes.subscribe(() => this._refreshStyles())
    this._refreshStyles()
  }

  public override reset(): void {
    this._unsubscribeWorkspace?.()
    this._unsubscribeStyles?.()
    this._unsubscribeProgram?.()
    this._unsubscribeUIRegistry?.()
    this._unsubscribeRuntimeScopes?.()
    this._unsubscribeWorkspace = null
    this._unsubscribeStyles = null
    this._unsubscribeProgram = null
    this._unsubscribeUIRegistry = null
    this._unsubscribeRuntimeScopes = null
    this._styleRuntime.reset()
    this._adapterFallbackIds = []
    this._started = false
  }

  private _activateWorkspaceAdapter(): void {
    const selectedId = Endge.workspace.defaultSfcAdapterId
    const selected = Endge.uiRegistry.adapters.resolveAvailable(
      selectedId,
      this._adapterFallbackIds,
    )
    if (!selected) {
      Endge.uiRegistry.adapters.require({ id: selectedId })
      return
    }
    if (selected.renderer !== 'vue-shadcn') {
      return
    }
    Endge.uiRegistry.adapters.activate({
      id: selected.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue-shadcn',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
      requiredRootKeys: ['shell', 'sfc', 'sfc-runtime', 'filter-view'],
    })
  }

  private _refreshStyles(): void {
    if (Endge.uiRegistry.adapters.active?.renderer !== 'vue-shadcn') {
      this._styleRuntime.reset()
      return
    }
    const artifacts: EndgeStylePlacement[] = [...Endge.styles.getActivePlacements()]
    const hiddenScopeIds = Endge.runtime.scopes.getAll()
      .filter(scope => scope.state !== 'active' && scope.state !== 'inactive' && scope.state !== 'disposed')
      .map(scope => scope.id)
    this._styleRuntime.update(artifacts, { renderer: 'dom', capabilities: ['shadcn'] }, hiddenScopeIds)
  }
}

/** Подключает vue-shadcn adapter к federation до Endge.boot(). */
export const EndgeVueShadcnPlugin: EndgePlugin = {
  id: '@endge/ui-vue-shadcn',
  install(): void {
    Endge.defineModule({
      key: 'vueShadcn',
      module: new EndgeVueShadcn_Module(),
      before: 'runtime',
    })
  },
}
