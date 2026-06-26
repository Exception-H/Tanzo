import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  useSaveLanguageDefaults,
  useSetConversationModel,
  useSetConversationSubagentModel
} from '../../model/mutations'
import {
  providerDefaultsWithReasoningEffort,
  reasoningEffortFromDefaults,
  type ReasoningEffort
} from '../../model/reasoning-effort'
import {
  findModelOption,
  getDefaultLanguageModel,
  useAvailableLanguageModels,
  type LanguageModelOption
} from '../../model/use-available-models'

export interface UseComposerModelResult {
  modelRef: string | null
  activeModel: LanguageModelOption | undefined
  effectiveReasoningEffort: ReasoningEffort
  handleSelectModel: (nextModelRef: string) => void
  handleReasoningEffortChange: (next: ReasoningEffort) => void
  subagentModelRef: string | null
  handleSelectSubagentModel: (nextModelRef: string) => void
}

export function useComposerModel({
  chatId,
  activeConversation
}: {
  chatId: string
  activeConversation: {
    id: string
    modelRef?: string | null
    subagentModelRef?: string | null
  } | null
}): UseComposerModelResult {
  const setModel = useSetConversationModel()
  const setSubagentModel = useSetConversationSubagentModel()
  const saveLanguageDefaults = useSaveLanguageDefaults()
  const { models } = useAvailableLanguageModels()

  const defaultModelRef = useMemo(() => getDefaultLanguageModel(models)?.id ?? null, [models])

  const storedModelRef = activeConversation?.modelRef || null
  const storedModel = useMemo(
    () => findModelOption(models, storedModelRef),
    [models, storedModelRef]
  )
  const modelRef = storedModel?.id ?? defaultModelRef
  const activeModel = useMemo(() => findModelOption(models, modelRef), [models, modelRef])

  const effectiveReasoningEffort: ReasoningEffort = activeModel
    ? reasoningEffortFromDefaults(activeModel.providerId, activeModel.providerDefaults)
    : 'default'

  const defaultedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!activeConversation || !defaultModelRef) return
    if (storedModel) return
    const defaultKey = `${activeConversation.id}:${defaultModelRef}`
    if (defaultedFor.current === defaultKey) return
    defaultedFor.current = defaultKey
    setModel.mutate({ chatId: activeConversation.id, modelRef: defaultModelRef })
  }, [activeConversation, defaultModelRef, setModel, storedModel])

  const handleSelectModel = useCallback(
    (nextModelRef: string) => {
      setModel.mutate({ chatId, modelRef: nextModelRef })
    },
    [setModel, chatId]
  )

  const handleReasoningEffortChange = useCallback(
    (next: ReasoningEffort) => {
      if (!activeModel) return
      const nextDefaults = providerDefaultsWithReasoningEffort(
        activeModel.providerId,
        activeModel.providerDefaults,
        next
      )
      saveLanguageDefaults.mutate({ providerId: activeModel.providerId, defaults: nextDefaults })
    },
    [activeModel, saveLanguageDefaults]
  )

  const storedSubagentModelRef = activeConversation?.subagentModelRef || null
  const subagentModelRef = useMemo(
    () => findModelOption(models, storedSubagentModelRef)?.id ?? null,
    [models, storedSubagentModelRef]
  )

  const handleSelectSubagentModel = useCallback(
    (nextModelRef: string) => {
      setSubagentModel.mutate({ chatId, modelRef: nextModelRef })
    },
    [setSubagentModel, chatId]
  )

  return {
    modelRef,
    activeModel,
    effectiveReasoningEffort,
    handleSelectModel,
    handleReasoningEffortChange,
    subagentModelRef,
    handleSelectSubagentModel
  }
}
