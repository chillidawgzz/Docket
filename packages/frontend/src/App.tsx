import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { patchDocument } from './api/client'
import type { Document } from './api/types'
import { BulkBar } from './components/BulkBar'
import { DocumentTable } from './components/DocumentTable'
import { Drawer } from './components/Drawer'
import { EditFilenameModal } from './components/EditFilenameModal'
import { EditTagsModal } from './components/EditTagsModal'
import { PreviewPanel } from './components/PreviewPanel'
import { Sidebar } from './components/Sidebar'
import { SyncPage } from './components/SyncPage'
import { Topbar } from './components/Topbar'
import { ViewModal } from './components/ViewModal'
import { useDocuments } from './hooks/useDocuments'
import { useFilters } from './hooks/useFilters'
import { useSelection } from './hooks/useSelection'
import { useSenderGroups } from './hooks/useSenderGroups'
import { useSyncStatus } from './hooks/useSyncStatus'
import { useTags } from './hooks/useTags'
import { filteredDocs } from './lib/filters'
import './styles/app.css'

const SIDEBAR_WIDTH_KEY = 'docket.sidebarWidth'
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 480
const SIDEBAR_DEFAULT = 250

function loadSidebarWidth() {
  try {
    const n = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    if (Number.isFinite(n) && n >= SIDEBAR_MIN && n <= SIDEBAR_MAX) return n
  } catch {
    /* ignore */
  }
  return SIDEBAR_DEFAULT
}

export default function App() {
  const { docs, loading, error, reload, upsertDoc } = useDocuments()
  const { tagNames, reloadTags } = useTags(docs)
  const {
    filters,
    setSearch,
    toggleSender,
    toggleGroup,
    toggleTagFilter,
    setTagFilters,
    setTagMode,
    setDateFrom,
    setDateTo,
    clearFilters,
    anyFilter,
  } = useFilters()
  const {
    groups,
    hiddenSenders,
    createGroup,
    updateGroup,
    removeGroup,
    setMembers,
    moveSender,
    hideSender,
    reorderGroups,
  } = useSenderGroups()
  const { checked, toggle, selectAll, clear } = useSelection()
  const {
    ui: syncUi,
    sync,
    pause,
    resume,
    cancel,
    config,
    progress,
    log,
    refreshConfig,
  } = useSyncStatus(reload)

  const [view, setView] = useState<'documents' | 'sync'>('documents')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [viewDocId, setViewDocId] = useState<string | null>(null)
  const [editTagsId, setEditTagsId] = useState<string | null>(null)
  const [editFilenameId, setEditFilenameId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
    } catch {
      /* ignore */
    }
  }, [sidebarWidth])

  const onSidebarResizeStart = useCallback(
    (clientX: number) => {
      const startX = clientX
      const startW = sidebarWidth
      const onMove = (ev: MouseEvent) => {
        const next = Math.min(
          SIDEBAR_MAX,
          Math.max(SIDEBAR_MIN, startW + (ev.clientX - startX)),
        )
        setSidebarWidth(next)
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.classList.remove('sidebar-resizing')
      }
      document.body.classList.add('sidebar-resizing')
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [sidebarWidth],
  )

  const list = useMemo(
    () => filteredDocs(docs, filters, groups, hiddenSenders),
    [docs, filters, groups, hiddenSenders],
  )

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
    (view === 'sync' ? ' sync-view' : '') +
    (previewId && view === 'documents' ? ' preview-open' : '') +
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
        onSave={async (filename) => {
          if (!editFilenameDoc) return
          const updated = await patchDocument(editFilenameDoc.id, { filename })
          upsertDoc(updated)
        }}
      />
      <div className="app">
        <Topbar
          search={filters.search}
          onSearchChange={setSearch}
          onToggleSidebar={() => setShowSidebar((v) => !v)}
          syncUi={syncUi}
          view={view}
          searchDisabled={view === 'sync'}
          onOpenSync={() => setView('sync')}
        />
        <div
          className={bodyClass}
          style={
            view === 'documents'
              ? ({ ['--sidebar-width' as string]: `${sidebarWidth}px` } as CSSProperties)
              : undefined
          }
        >
          {view === 'sync' ? (
            <SyncPage
              config={config}
              syncing={syncUi.syncing}
              paused={syncUi.paused}
              progress={progress}
              log={log}
              onSync={(opts) => void sync(opts)}
              onPause={() => void pause()}
              onResume={() => void resume()}
              onCancel={() => void cancel()}
              onBack={() => setView('documents')}
              onRefreshConfig={() => void refreshConfig()}
            />
          ) : (
            <>
              <Sidebar
                docs={docs}
                filters={filters}
                anyFilter={anyFilter}
                tagSuggestions={tagNames}
                groups={groups}
                hiddenSenders={hiddenSenders}
                onResizeStart={onSidebarResizeStart}
                onToggleSender={(name) => {
                  toggleSender(name)
                  closeMobileSidebar()
                }}
                onToggleGroup={(groupId) => {
                  toggleGroup(groupId)
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
                onCreateGroup={createGroup}
                onUpdateGroup={updateGroup}
                onDeleteGroup={removeGroup}
                onSetGroupMembers={setMembers}
                onMoveSender={moveSender}
                onHideSender={hideSender}
                onReorderGroups={reorderGroups}
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
            </>
          )}
        </div>
      </div>
    </>
  )
}
