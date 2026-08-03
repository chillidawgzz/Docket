import type { Document } from '../api/types'
import { formatSize } from '../lib/format'
import { zipUrl } from '../api/client'

interface BulkBarProps {
  docs: Document[]
  checked: Set<string>
  onClear: () => void
  onRename: () => void
  onTag: () => void
}

export function BulkBar({
  docs,
  checked,
  onClear,
  onRename,
  onTag,
}: BulkBarProps) {
  const checkedDocs = docs.filter((d) => checked.has(d.id))
  if (checkedDocs.length === 0) return null

  const totalBytes = checkedDocs.reduce((sum, d) => sum + d.size, 0)
  const canBulk = checkedDocs.length >= 2

  return (
    <div className="bulk-bar">
      <span className="bulk-summary">
        <b>{checkedDocs.length}</b> selected · {formatSize(totalBytes)} total
      </span>
      {canBulk && (
        <>
          <button type="button" className="btn-clear" onClick={onTag}>
            Tags…
          </button>
          <button type="button" className="btn-clear" onClick={onRename}>
            Rename…
          </button>
        </>
      )}
      <button
        type="button"
        className="btn-download"
        onClick={() => {
          const ids = checkedDocs.map((d) => d.id)
          window.location.href = zipUrl(ids)
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v12m0 0l-4-4m4 4l4-4M4 19h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download .zip
      </button>
      <button type="button" className="btn-clear" onClick={onClear}>
        Clear
      </button>
    </div>
  )
}
