import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { patchDocument } from './api/client'
import type { Document } from './api/types'
import { BulkBar } from './components/BulkBar'
import { BulkRenameModal } from './components/BulkRenameModal'
import {
  applyBulkTags,
  BulkTagsModal,
} from './components/BulkTagsModal'
import { DocumentTable } from './components/DocumentTable'
import { EditFilenameModal } from './components/EditFilenameModal'
import { EditTagsModal } from './components/EditTagsModal'
import { GroupsPage } from './components/GroupsPage'
import { PreviewPage } from './components/PreviewPage'
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
import { bySenderName, filteredDocs } from './lib/filters'
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

type AppView = 'documents' | 'sync' | 'groups' | 'preview'

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

  const [view, setView] = useState<AppView>('documents')
  const [activeDocId, setActiveDocId] = useState<string | null>(null)
  const [viewDocId, setViewDocId] = useState<string | null>(null)
  const [editTagsId, setEditTagsId] = useState<string | null>(null)
  const [editFilenameId, setEditFilenameId] = useState<string | null>(null)
  const [bulkRenameOpen, setBulkRenameOpen] = useState(false)
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false)
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

  const previewDoc = activeDocId
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
  const bulkRenameDocs = useMemo(
    () => (bulkRenameOpen ? docs.filter((d) => checked.has(d.id)) : []),
    [bulkRenameOpen, docs, checked],
  )
  const bulkTagDocs = useMemo(
    () => (bulkTagsOpen ? docs.filter((d) => checked.has(d.id)) : []),
    [bulkTagsOpen, docs, checked],
  )

  const closeMobileSidebar = useCallback(() => {
    if (window.innerWidth <= 900) setShowSidebar(false)
  }, [])

  const onRowActivate = useCallback((id: string) => {
    setActiveDocId(id)
    setView('preview')
  }, [])

  const onView = useCallback((doc: Document) => {
    setViewDocId(doc.id)
  }, [])

  const onBackToDocuments = useCallback(() => {
    setView('documents')
    setActiveDocId(null)
  }, [])

  const showDocuments = useCallback(() => {
    setView('documents')
    setActiveDocId(null)
    closeMobileSidebar()
  }, [closeMobileSidebar])

  useEffect(() => {
    if (view === 'preview' && activeDocId && !previewDoc) {
      setView('documents')
      setActiveDocId(null)
    }
  }, [view, activeDocId, previewDoc])

  const bodyClass = 'body' + (showSidebar ? ' show-sidebar' : '')

  const mainPane =
    view === 'sync' ? (
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
        onBack={onBackToDocuments}
        onRefreshConfig={() => void refreshConfig()}
      />
    ) : view === 'groups' ? (
      <GroupsPage
        groups={groups}
        allSenders={bySenderName(docs).map((s) => s.name)}
        onBack={onBackToDocuments}
        onCreate={createGroup}
        onRename={(id, name) => updateGroup(id, { name })}
        onDelete={removeGroup}
        onSetMembers={setMembers}
        onReorder={reorderGroups}
      />
    ) : view === 'preview' && previewDoc ? (
      <PreviewPage
        doc={previewDoc}
        onBack={onBackToDocuments}
        onView={onView}
        onRename={async (filename) => {
          const updated = await patchDocument(previewDoc.id, { filename })
          upsertDoc(updated)
        }}
      />
    ) : (
      <DocumentTable
        list={list}
        loading={loading}
        error={error}
        checked={checked}
        previewId={activeDocId}
        onToggleCheck={toggle}
        onRowActivate={onRowActivate}
        onSelectAll={(rows) => selectAll(rows)}
        onRetry={() => void reload()}
        onEditTags={(doc) => setEditTagsId(doc.id)}
        onEditFilename={(doc) => setEditFilenameId(doc.id)}
      >
        <BulkBar
          docs={docs}
          checked={checked}
          onClear={clear}
          onRename={() => setBulkRenameOpen(true)}
          onTag={() => setBulkTagsOpen(true)}
        />
      </DocumentTable>
    )

  return (
    <>
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
      <BulkRenameModal
        docs={bulkRenameDocs}
        onClose={() => setBulkRenameOpen(false)}
        onSave={async (renames) => {
          for (const { id, filename } of renames) {
            const updated = await patchDocument(id, { filename })
            upsertDoc(updated)
          }
          clear()
        }}
      />
      <BulkTagsModal
        docs={bulkTagDocs}
        suggestions={tagNames}
        onClose={() => setBulkTagsOpen(false)}
        onSave={async (tags, mode) => {
          for (const doc of bulkTagDocs) {
            const next = applyBulkTags(doc.tags, tags, mode)
            const updated = await patchDocument(doc.id, { tags: next })
            upsertDoc(updated)
          }
          await reloadTags()
          clear()
        }}
      />
      <div className="app">
        <Topbar
          search={filters.search}
          onSearchChange={(value) => {
            setSearch(value)
            if (view !== 'documents') showDocuments()
          }}
          onToggleSidebar={() => setShowSidebar((v) => !v)}
          syncUi={syncUi}
          view={view}
          searchDisabled={false}
          onOpenSync={() => setView('sync')}
          onGoHome={onBackToDocuments}
        />
        <div
          className={bodyClass}
          style={
            { ['--sidebar-width' as string]: `${sidebarWidth}px` } as CSSProperties
          }
        >
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
              showDocuments()
            }}
            onToggleGroup={(groupId) => {
              toggleGroup(groupId)
              showDocuments()
            }}
            onToggleTag={(tag) => {
              toggleTagFilter(tag)
              showDocuments()
            }}
            onSetTagFilters={(tags) => {
              setTagFilters(tags)
              showDocuments()
            }}
            onSetTagMode={(mode) => {
              setTagMode(mode)
              showDocuments()
            }}
            onSetDateFrom={(value) => {
              setDateFrom(value)
              showDocuments()
            }}
            onSetDateTo={(value) => {
              setDateTo(value)
              showDocuments()
            }}
            onClearFilters={() => {
              clearFilters()
              showDocuments()
            }}
            onManageGroups={() => setView('groups')}
            onUpdateGroup={updateGroup}
            onMoveSender={moveSender}
            onHideSender={hideSender}
            onReorderGroups={reorderGroups}
          />
          {mainPane}
        </div>
      </div>
    </>
  )
}
