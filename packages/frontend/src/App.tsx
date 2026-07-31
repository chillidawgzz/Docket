import { useCallback, useMemo, useState } from 'react'
import { patchDocument } from './api/client'
import type { Document } from './api/types'
import { BulkBar } from './components/BulkBar'
import { DocumentTable } from './components/DocumentTable'
import { Drawer } from './components/Drawer'
import { EditFilenameModal } from './components/EditFilenameModal'
import { EditTagsModal } from './components/EditTagsModal'
import { PreviewPanel } from './components/PreviewPanel'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import { ViewModal } from './components/ViewModal'
import { useDocuments } from './hooks/useDocuments'
import { useFilters } from './hooks/useFilters'
import { useSelection } from './hooks/useSelection'
import { useSyncStatus } from './hooks/useSyncStatus'
import { useTags } from './hooks/useTags'
import { filteredDocs } from './lib/filters'
import './styles/app.css'

export default function App() {
  const { docs, loading, error, reload, upsertDoc } = useDocuments()
  const { tagNames, reloadTags } = useTags(docs)
  const {
    filters,
    setSearch,
    toggleSender,
    toggleTagFilter,
    setTagFilters,
    setTagMode,
    setDateFrom,
    setDateTo,
    clearFilters,
    anyFilter,
  } = useFilters()
  const { checked, toggle, selectAll, clear } = useSelection()
  const { ui: syncUi, sync } = useSyncStatus(reload)

  const [previewId, setPreviewId] = useState<string | null>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [viewDocId, setViewDocId] = useState<string | null>(null)
  const [editTagsId, setEditTagsId] = useState<string | null>(null)
  const [editFilenameId, setEditFilenameId] = useState<string | null>(null)
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
  const editTagsDoc = editTagsId
    ? (docs.find((d) => d.id === editTagsId) ?? null)
    : null
  const editFilenameDoc = editFilenameId
    ? (docs.find((d) => d.id === editFilenameId) ?? null)
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
      <EditTagsModal
        doc={editTagsDoc}
        suggestions={tagNames}
        onClose={() => setEditTagsId(null)}
        onSave={async (tags) => {
          if (!editTagsDoc) return
          const updated = await patchDocument(editTagsDoc.id, { tags })
          upsertDoc(updated)
          await reloadTags()
        }}
      />
      <EditFilenameModal
        doc={editFilenameDoc}
        onClose={() => setEditFilenameId(null)}
        onSave={async (downloadFilename) => {
          if (!editFilenameDoc) return
          const updated = await patchDocument(editFilenameDoc.id, {
            downloadFilename: downloadFilename || null,
          })
          upsertDoc(updated)
        }}
      />
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
            tagSuggestions={tagNames}
            onToggleSender={(name) => {
              toggleSender(name)
              closeMobileSidebar()
            }}
            onToggleTag={(tag) => {
              toggleTagFilter(tag)
            }}
            onSetTagFilters={setTagFilters}
            onSetTagMode={setTagMode}
            onSetDateFrom={setDateFrom}
            onSetDateTo={setDateTo}
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
            onEditTags={(doc) => setEditTagsId(doc.id)}
            onEditFilename={(doc) => setEditFilenameId(doc.id)}
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
