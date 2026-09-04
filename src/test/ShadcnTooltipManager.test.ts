// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ShadcnTooltipManager } from '@/ui/overlay/tooltip/shadcn-tooltip-manager'

describe('менеджер tooltip Shadcn', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it('сохраняет один запрос, лениво отрисовывает и очищает повторно используемые anchors', () => {
    const first = document.createElement('span')
    const second = document.createElement('span')
    document.body.append(first, second)
    const firstContent = vi.fn(() => 'first')
    const secondContent = vi.fn(() => 'second')
    const manager = new ShadcnTooltipManager({ side: 'right', align: 'start', openDelay: 25, closeDelay: 0 })

    manager.activate({ ownerId: 'first', domId: 'first-tip', anchor: first, kind: 'text', renderContent: firstContent }, 'pointer')
    manager.activate({ ownerId: 'second', domId: 'second-tip', anchor: second, kind: 'rich', renderContent: secondContent }, 'pointer')
    vi.advanceTimersByTime(25)

    expect(firstContent).not.toHaveBeenCalled()
    expect(secondContent).toHaveBeenCalledOnce()
    expect(manager.state.ownerId).toBe('second')
    manager.close('second')
    expect(manager.state.content).toBeNull()
  })

  it('отменяет ожидающее содержимое и освобождает anchor при dispose', () => {
    const anchor = document.createElement('span')
    document.body.append(anchor)
    const renderContent = vi.fn(() => 'never')
    const manager = new ShadcnTooltipManager({
      side: 'bottom',
      align: 'center',
      openDelay: 100,
      closeDelay: 25,
    })

    manager.activate({ ownerId: 'owner', domId: 'tooltip', anchor, kind: 'rich', renderContent }, 'focus')
    manager.dispose()
    vi.runAllTimers()

    expect(renderContent).not.toHaveBeenCalled()
    expect(manager.state).toMatchObject({ phase: 'idle', anchor: null, content: null })
    expect(anchor.hasAttribute('aria-describedby')).toBe(false)
  })
})
