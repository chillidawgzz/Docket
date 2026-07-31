import { useEffect, useMemo, useRef, useState } from 'react'

interface TagPickerProps {
  value: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function TagPicker({
  value,
  suggestions,
  onChange,
  placeholder = 'Add tag…',
}: TagPickerProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const selected = new Set(value.map((t) => t.toLowerCase()))
    return suggestions
      .filter((s) => !selected.has(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 12)
  }, [suggestions, value, query])

  const canCreate =
    query.trim().length > 0 &&
    !value.some((t) => t.toLowerCase() === query.trim().toLowerCase()) &&
    !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase())

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [])

  const add = (tag: string) => {
    const t = tag.trim()
    if (!t) return
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) return
    onChange([...value, t])
    setQuery('')
    setOpen(true)
  }

  const remove = (tag: string) => {
    onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()))
  }

  return (
    <div className="tag-picker" ref={rootRef}>
      <div className="tag-picker-chips">
        {value.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              className="tag-chip-remove"
              aria-label={`Remove ${tag}`}
              onClick={() => remove(tag)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-picker-input"
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) add(filtered[0])
              else if (canCreate) add(query)
            } else if (e.key === 'Backspace' && !query && value.length) {
              remove(value[value.length - 1])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
      </div>
      {open && (filtered.length > 0 || canCreate) && (
        <div className="tag-picker-dropdown" role="listbox">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="tag-picker-option"
              role="option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(s)}
            >
              {s}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              className="tag-picker-option tag-picker-option--create"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(query)}
            >
              Create “{query.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}
