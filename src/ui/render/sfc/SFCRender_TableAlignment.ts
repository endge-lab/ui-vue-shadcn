export type SFCTableCellAlign = 'left' | 'center' | 'right'
export type SFCTableCellVerticalAlign = 'top' | 'middle' | 'bottom'

export interface SFCTableCellAlignment {
  horizontal: SFCTableCellAlign
  vertical: SFCTableCellVerticalAlign
}

const HORIZONTAL_ALIGNMENTS = new Set<SFCTableCellAlign>(['left', 'center', 'right'])
const VERTICAL_ALIGNMENTS = new Set<SFCTableCellVerticalAlign>(['top', 'middle', 'bottom'])

/** Нормализует renderer-neutral значения выравнивания ячеек Table. */
export function normalizeSFCTableCellAlignment(
  horizontal: unknown,
  vertical: unknown,
): SFCTableCellAlignment {
  return {
    horizontal: normalizeHorizontalAlignment(horizontal),
    vertical: normalizeVerticalAlignment(vertical),
  }
}

function normalizeHorizontalAlignment(value: unknown): SFCTableCellAlign {
  const normalized = normalizeAlignmentValue(value)
  return HORIZONTAL_ALIGNMENTS.has(normalized as SFCTableCellAlign)
    ? (normalized as SFCTableCellAlign)
    : 'left'
}

function normalizeVerticalAlignment(value: unknown): SFCTableCellVerticalAlign {
  const normalized = normalizeAlignmentValue(value)
  return VERTICAL_ALIGNMENTS.has(normalized as SFCTableCellVerticalAlign)
    ? (normalized as SFCTableCellVerticalAlign)
    : 'middle'
}

function normalizeAlignmentValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}
