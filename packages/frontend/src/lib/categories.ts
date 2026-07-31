import type { CategoryKey } from '../api/types'

export const CATEGORIES: Record<
  CategoryKey,
  { label: string; color: string }
> = {
  tax: { label: 'Tax', color: '#F5B942' },
  utilities: { label: 'Utilities', color: '#3EC1D3' },
  banking: { label: 'Banking', color: '#9B7CF2' },
  insurance: { label: 'Insurance', color: '#34D0BA' },
  medical: { label: 'Medical', color: '#F2637A' },
  housing: { label: 'Housing', color: '#F5924A' },
  receipts: { label: 'Receipts', color: '#8A93A3' },
  uncategorized: { label: 'Uncategorized', color: '#565F6E' },
}
