import type { EndgeStylePlacement, EndgeStyleSheetArtifact, EndgeStyleTargetProfile } from '@endge/core'

import { materializeEndgeCSSForDOM } from '@/services/style/endge-dom-style'

/** Владеет одной атомарно заменяемой таблицей стилей для Vue DOM renderer. */
export class EndgeDOMStyleRuntime {
  private _sheet: CSSStyleSheet | null = null
  private _fallback: HTMLStyleElement | null = null
  private _lastKey = ''

  public update(
    artifacts: readonly (EndgeStyleSheetArtifact | EndgeStylePlacement)[],
    target: EndgeStyleTargetProfile,
    hiddenScopeIds: readonly string[] = [],
  ): void {
    if (typeof document === 'undefined') {
      return
    }
    const key = `${target.renderer}:${[...(target.capabilities ?? [])].sort().join(',')}:${artifacts.map(item => 'artifact' in item ? `${item.artifact.sourceHash}@${item.boundaryId}:${item.orderKey}` : item.sourceHash).join(':')}:hidden=${[...hiddenScopeIds].sort().join(',')}`
    if (key === this._lastKey) {
      return
    }
    this._lastKey = key
    const materialized = materializeEndgeCSSForDOM(artifacts, target)
    const hiddenCss = hiddenScopeIds
      .map(id => `[data-endge-runtime-scope~=${JSON.stringify(id)}]{display:none!important;}`)
      .join('\n')
    const css = [materialized.css, hiddenCss].filter(Boolean).join('\n')

    const root = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }
    if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype && Array.isArray(root.adoptedStyleSheets)) {
      this._fallback?.remove()
      this._fallback = null
      this._sheet ??= new CSSStyleSheet()
      this._sheet.replaceSync(css)
      if (!root.adoptedStyleSheets.includes(this._sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, this._sheet]
      }
      return
    }

    this._fallback ??= this._createFallback()
    this._fallback.textContent = css
  }

  public reset(): void {
    if (typeof document !== 'undefined' && this._sheet) {
      const root = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }
      if (Array.isArray(root.adoptedStyleSheets)) {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => sheet !== this._sheet)
      }
    }
    this._fallback?.remove()
    this._fallback = null
    this._sheet = null
    this._lastKey = ''
  }

  private _createFallback(): HTMLStyleElement {
    const element = document.createElement('style')
    element.dataset.endgeStyles = ''
    document.head.append(element)
    return element
  }
}
