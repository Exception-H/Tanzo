import { useCallback } from 'react'
import { useChatUiStore } from './store'

export function useDisclosure(
  key: string,
  defaultOpen: boolean
): [boolean, (open: boolean) => void, boolean] {
  const stored = useChatUiStore((state) => state.disclosureById[key])
  const setDisclosure = useChatUiStore((state) => state.setDisclosure)
  const open = stored ?? defaultOpen
  const setOpen = useCallback((next: boolean) => setDisclosure(key, next), [setDisclosure, key])
  return [open, setOpen, stored !== undefined]
}
