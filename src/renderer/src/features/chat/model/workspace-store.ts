import { createStore, type StoreApi } from 'zustand/vanilla'

export type WorkspaceId = string

export interface WorkspaceRecord {
  id: WorkspaceId
  label: string
  cwd: string
  createdAt: number
  lastActivityAt: number
  expanded: boolean
}

export interface WorkspaceState {
  currentId: WorkspaceId | null
  expandedById: Record<WorkspaceId, boolean>
}

const INITIAL: WorkspaceState = {
  currentId: null,
  expandedById: {}
}

export const workspaceStore: StoreApi<WorkspaceState> = createStore<WorkspaceState>()(() => INITIAL)

export const workspaceActions = {
  setCurrent(id: WorkspaceId | null): void {
    const state = workspaceStore.getState()
    if (state.currentId === id) return
    workspaceStore.setState({ currentId: id })
  },

  toggleExpanded(id: WorkspaceId): void {
    workspaceStore.setState((state) => ({
      expandedById: {
        ...state.expandedById,
        [id]: !(state.expandedById[id] ?? true)
      }
    }))
  },

  prune(workspaceIds: ReadonlySet<WorkspaceId>): void {
    workspaceStore.setState((state) => {
      const expandedById: Record<WorkspaceId, boolean> = {}
      let changed = false

      for (const [id, expanded] of Object.entries(state.expandedById)) {
        if (!workspaceIds.has(id)) {
          changed = true
          continue
        }
        expandedById[id] = expanded
      }

      const currentId =
        state.currentId && workspaceIds.has(state.currentId) ? state.currentId : null
      if (currentId !== state.currentId) changed = true

      return changed ? { currentId, expandedById } : state
    })
  }
}
