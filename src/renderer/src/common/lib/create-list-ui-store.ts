import { create, type StoreApi, type UseBoundStore } from 'zustand'
import { devtools } from 'zustand/middleware'

type Filters = Record<string, string | undefined>

export interface ListUiStore<F extends Filters> {
  searchQuery: string
  filters: F
  setSearchQuery: (query: string) => void
  setFilter: (key: keyof F, value: string | undefined) => void
}

export function createListUiStore<F extends Filters>(
  name: string,
  initialFilters: F
): UseBoundStore<StoreApi<ListUiStore<F>>> {
  return create<ListUiStore<F>>()(
    devtools(
      (set) => ({
        searchQuery: '',
        filters: initialFilters,
        setSearchQuery: (query) =>
          set((state) => (state.searchQuery === query ? state : { searchQuery: query })),
        setFilter: (key, value) =>
          set((state) => {
            if (state.filters[key] === value) return state
            if (value === undefined) {
              const nextFilters = { ...state.filters }
              delete nextFilters[key]
              return { filters: nextFilters }
            }
            return { filters: { ...state.filters, [key]: value } }
          })
      }),
      { name }
    )
  )
}
