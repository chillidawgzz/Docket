import { useCallback, useMemo, useState } from 'react'
import type { Document } from './api/types'
import { BulkBar } from './components/BulkBar'
import { DocumentTable } from './components/DocumentTable'
import { Drawer } from './components/Drawer'
import { PreviewPanel } from './components/PreviewPanel'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { ViewModal } from './components/ViewModal'
import { useDocuments } from './hooks/useDocuments'
import { useFilters } from './hooks/useFilters'
import { useSelection } from './hooks/useSelection'
import { useSyncStatus } from './hooks/useSyncStatus'
import { filteredDocs } from './lib/filters'
import './styles/app.css'

export default function App() {
  const { docs, loading, error, reload } = useDocuments()
  const {
    filters,
    setSearch,
    toggleSender,
    toggleCategory,
    toggleYear,
    clearFilters,
    anyFilter,
  } = useFilters()
  const { checked, toggle, selectAll, clear } = useSelection()
  const { ui: syncUi, sync } = useSyncStatus(reload)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [viewDocId, setViewDocId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)

  const list = useMemo(() => filteredDocs(docs, filters), [docs, filters])
  const previewDoc = previewId
    ? (docs.find((d) => d.id === previewId) ?? null)
    : null
  const drawerDoc = activeDocId
    ? (docs.find((d) => d.id === activeDocId) ?? null)
    : null
  const viewDoc = viewDocId
    ? (docs.find((d) => d.id === viewDocId) ?? null)
    : null

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth <= 900) setShowSidebar(false)
  }, [])

  const onRowActivate = useCallback((id: string) => {
    setPreviewId((prev) => (prev === id ? null : id))
    setActiveDocId((prev) => (prev === id ? null : id))
  }, [])

  const onView = useCallback((doc: Document) => {
    setViewDocId(doc.id)
  }, [])

  const bodyClass =
    'body' +
    (previewId ? ' preview-open' : '') +
    (showSidebar ? ' show-sidebar' : '')

  return (
    <>
      <Drawer
        doc={drawerDoc}
        onClose={() => setActiveDocId(null)}
        onView={onView}
      />
      <ViewModal doc={viewDoc} onClose={() => setViewDocId(null)} />
      <div className="app">
        <Topbar
          search={filters.search}
          onSearchChange={setSearch}
          onToggleSidebar={() => setShowSidebar((v) => !v)}
          syncUi={syncUi}
          onSync={() => void sync()}
        />
        <div className={bodyClass}>
          <Sidebar
            docs={docs}
            filters={filters}
            anyFilter={anyFilter}
            onToggleSender={(name) => {
              toggleSender(name)
              closeMobileSidebar()
            }}
            onToggleCategory={(key) => {
              toggleCategory(key)
              closeMobileSidebar()
            }}
            onToggleYear={(year) => {
              toggleYear(year)
              closeMobileSidebar()
            }}
            onClearFilters={clearFilters}
          />
          <DocumentTable
            list={list}
            loading={loading}
            error={error}
            checked={checked}
            previewId={previewId}
            onToggleCheck={toggle}
            onRowActivate={onRowActivate}
            onSelectAll={(rows) => selectAll(rows)}
            onRetry={() => void reload()}
          >
            <BulkBar docs={docs} checked={checked} onClear={clear} />
          </DocumentTable>
          <PreviewPanel
            doc={previewDoc}
            onClose={() => setPreviewId(null)}
            onView={onView}
          />
        </div>
      </div>
    </>
  )
}
