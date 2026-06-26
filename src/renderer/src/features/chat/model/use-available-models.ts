import { useMemo } from 'react'
import type {
  ModelCapabilityFlags,
  ProviderDefaultsState,
  ProviderId,
  ProviderSetupState,
  StoredProviderModel
} from '@/common/contracts'
import { useProviderSetups } from '@/features/providers/model/queries'

export interface LanguageModelOption {
  id: string
  providerId: ProviderId
  modelKey: string
  name: string
  description?: string
  contextWindow?: number
  maxOutput?: number
  capabilities?: ModelCapabilityFlags
  isDefault: boolean
  providerDefaults: ProviderDefaultsState
}

export interface UseAvailableLanguageModelsResult {
  models: LanguageModelOption[]

  byProvider: Array<{ providerId: ProviderId; models: LanguageModelOption[] }>

  isEmpty: boolean
  isLoading: boolean
  isError: boolean
  refetch: () => Promise<unknown>
}

function modelOptionFromStored(
  providerId: ProviderId,
  model: StoredProviderModel,
  isDefault: boolean,
  providerDefaults: ProviderDefaultsState
): LanguageModelOption {
  const base: LanguageModelOption = {
    id: `${providerId}:${model.id}`,
    providerId,
    modelKey: model.id,
    name: model.name,
    isDefault,
    providerDefaults
  }
  if (model.description) base.description = model.description
  const ctx = model.contextWindowOverride ?? model.contextWindow
  if (typeof ctx === 'number') base.contextWindow = ctx
  if (typeof model.maxOutput === 'number') base.maxOutput = model.maxOutput
  if (model.capabilities) base.capabilities = model.capabilities
  return base
}

function projectSetups(setups: ProviderSetupState[]): LanguageModelOption[] {
  const out: LanguageModelOption[] = []
  for (const setup of setups) {
    if (setup.connection.status !== 'connected') continue
    const family = setup.modalities?.language
    if (!family) continue
    const enabled = new Set(family.enabledModelIds)
    if (enabled.size === 0) continue
    for (const stored of family.models) {
      if (!enabled.has(stored.id)) continue
      out.push(
        modelOptionFromStored(
          setup.providerId,
          stored,
          family.defaultModelId === stored.id,
          family.defaults
        )
      )
    }
  }
  return out
}

export function useAvailableLanguageModels(): UseAvailableLanguageModelsResult {
  const setupsQuery = useProviderSetups()
  const setups = setupsQuery.data

  const models = useMemo<LanguageModelOption[]>(() => projectSetups(setups ?? []), [setups])

  const byProvider = useMemo(() => {
    const order: ProviderId[] = []
    const buckets = new Map<ProviderId, LanguageModelOption[]>()
    for (const m of models) {
      if (!buckets.has(m.providerId)) {
        order.push(m.providerId)
        buckets.set(m.providerId, [])
      }
      buckets.get(m.providerId)!.push(m)
    }
    return order.map((providerId) => ({ providerId, models: buckets.get(providerId)! }))
  }, [models])

  return {
    models,
    byProvider,
    isEmpty: models.length === 0,
    isLoading: setupsQuery.isLoading,
    isError: setupsQuery.isError,
    refetch: () => setupsQuery.refetch()
  }
}

export function getDefaultLanguageModel(
  models: ReadonlyArray<LanguageModelOption>
): LanguageModelOption | undefined {
  return models.find((model) => model.isDefault) ?? models[0]
}

export function findModelOption(
  models: ReadonlyArray<LanguageModelOption>,
  id: string | null | undefined
): LanguageModelOption | undefined {
  if (!id) return undefined
  return models.find((m) => m.id === id)
}
