import { useCallback, useEffect, useState } from 'react'
import {
  addSenderToGroup,
  createSenderGroup,
  deleteSenderGroup,
  fetchSenderGroups,
  patchSenderGroup,
  removeSenderFromGroup,
  setSenderGroupMembers,
  setSenderHidden,
} from '../api/client'
import type { SenderGroupInfo, SenderGroupsState } from '../lib/filters'

function normalize(state: {
  groups: Array<{
    id: number
    name: string
    collapsed: boolean
    hidden: boolean
    senders: string[]
  }>
  hiddenSenders: string[]
}): SenderGroupsState {
  return {
    groups: state.groups.map(
      (g): SenderGroupInfo => ({
        id: g.id,
        name: g.name,
        collapsed: Boolean(g.collapsed),
        hidden: Boolean(g.hidden),
        senders: Array.isArray(g.senders) ? g.senders : [],
      }),
    ),
    hiddenSenders: Array.isArray(state.hiddenSenders) ? state.hiddenSenders : [],
  }
}

const empty: SenderGroupsState = { groups: [], hiddenSenders: [] }

export function useSenderGroups() {
  const [state, setState] = useState<SenderGroupsState>(empty)
  const [loading, setLoading] = useState(true)

  const apply = useCallback((next: SenderGroupsState) => {
    setState(normalize(next))
  }, [])

  const reload = useCallback(async () => {
    try {
      const next = await fetchSenderGroups()
      apply(next)
    } catch {
      /* keep previous */
    } finally {
      setLoading(false)
    }
  }, [apply])

  useEffect(() => {
    void reload()
  }, [reload])

  const createGroup = useCallback(
    async (name: string) => {
      apply(await createSenderGroup(name))
    },
    [apply],
  )

  const updateGroup = useCallback(
    async (
      id: number,
      patch: { name?: string; collapsed?: boolean; hidden?: boolean },
    ) => {
      apply(await patchSenderGroup(id, patch))
    },
    [apply],
  )

  const removeGroup = useCallback(
    async (id: number) => {
      apply(await deleteSenderGroup(id))
    },
    [apply],
  )

  const setMembers = useCallback(
    async (id: number, senders: string[]) => {
      apply(await setSenderGroupMembers(id, senders))
    },
    [apply],
  )

  const moveSender = useCallback(
    async (sender: string, groupId: number | null) => {
      if (groupId == null) {
        const current = state.groups.find((g) => g.senders.includes(sender))
        if (current) apply(await removeSenderFromGroup(current.id, sender))
        return
      }
      apply(await addSenderToGroup(groupId, sender))
    },
    [apply, state.groups],
  )

  const hideSender = useCallback(
    async (sender: string, hidden: boolean) => {
      apply(await setSenderHidden(sender, hidden))
    },
    [apply],
  )

  return {
    groups: state.groups,
    hiddenSenders: state.hiddenSenders,
    loading,
    reload,
    createGroup,
    updateGroup,
    removeGroup,
    setMembers,
    moveSender,
    hideSender,
  }
}
