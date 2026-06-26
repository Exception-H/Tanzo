import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type {
  AddProviderKeyInput,
  ConnectionTestResult,
  ModelFamily,
  ProviderId,
  ProviderSetupState,
  ProviderWorkspace,
  SaveProviderConnectionInput,
  SaveProviderDefaultsInput,
  SaveProviderModelStateInput,
  UpdateProviderKeyInput
} from '@/common/contracts'
import { providersClient } from '@/platform/electron/providers-client'
import { errorMessage } from '@/common/lib/error-utils'
import { providerKeys } from './query-keys'

function invalidateProvider(queryClient: QueryClient, providerId: ProviderId): void {
  queryClient.invalidateQueries({ queryKey: providerKeys.setups() })
  queryClient.invalidateQueries({ queryKey: providerKeys.workspace(providerId) })
  queryClient.invalidateQueries({ queryKey: providerKeys.keys(providerId) })
}

function patchSetupsWithWorkspace(
  setups: ProviderSetupState[] | undefined,
  workspace: ProviderWorkspace,
  defaultScope?: ModelFamily
): ProviderSetupState[] | undefined {
  if (!setups) return setups
  return setups.map((setup) => {
    if (setup.providerId === workspace.setup.providerId) return workspace.setup
    if (!defaultScope) return setup
    const family = setup.modalities[defaultScope]
    if (!family) return setup
    return {
      ...setup,
      modalities: {
        ...setup.modalities,
        [defaultScope]: {
          ...family,
          defaultModelId: null,
          models: family.models.map((model) => ({ ...model, isDefault: false }))
        }
      }
    }
  })
}

export function useSaveProviderConnection() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveProviderConnectionInput) => providersClient.saveConnection(input),
    onSuccess: (workspace, input) => {
      queryClient.setQueryData(providerKeys.workspace(input.providerId), workspace)
      invalidateProvider(queryClient, input.providerId)
      toast.success(t('providers.notifications.connectionSaved'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.connectionSaveFailed')))
  })
}

export function useTestProviderConnection(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ConnectionTestResult> =>
      providersClient.testConnection(providerId),
    onSuccess: (result) => {
      invalidateProvider(queryClient, providerId)
      if (result.success) {
        toast.success(result.message || t('providers.notifications.connectionTestPassed'))
      } else {
        toast.error(result.message || t('providers.notifications.connectionTestFailed'))
      }
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.connectionTestFailed')))
  })
}

export function useDisconnectProvider(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => providersClient.disconnect(providerId),
    onSuccess: () => {
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.disconnected'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.disconnectFailed')))
  })
}

export function useResetProvider(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => providersClient.reset(providerId),
    onSuccess: () => {
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.reset'))
    },
    onError: (error) => toast.error(errorMessage(error, t('providers.notifications.resetFailed')))
  })
}

export function useAddProviderKey(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<AddProviderKeyInput, 'providerId'>) =>
      providersClient.addKey({ providerId, ...input }),
    onSuccess: (keys) => {
      queryClient.setQueryData(providerKeys.keys(providerId), keys)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.apiKeyAdded'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.apiKeyAddFailed')))
  })
}

export function useUpdateProviderKey(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<UpdateProviderKeyInput, 'providerId'>) =>
      providersClient.updateKey({ providerId, ...input }),
    onSuccess: (keys) => {
      queryClient.setQueryData(providerKeys.keys(providerId), keys)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.apiKeyUpdated'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.apiKeyUpdateFailed')))
  })
}

export function useDeleteProviderKey(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (keyId: string) => providersClient.deleteKey(providerId, keyId),
    onSuccess: (keys) => {
      queryClient.setQueryData(providerKeys.keys(providerId), keys)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.apiKeyDeleted'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.apiKeyDeleteFailed')))
  })
}

export function useSetActiveProviderKey(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (keyId: string) => providersClient.setActiveKey(providerId, keyId),
    onSuccess: (workspace) => {
      queryClient.setQueryData(providerKeys.workspace(providerId), workspace)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.activeApiKeyChanged'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.activeApiKeyChangeFailed')))
  })
}

export function useSyncProviderModels(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (family: ModelFamily) => providersClient.syncModels(providerId, family),
    onSuccess: (result, family) => {
      invalidateProvider(queryClient, providerId)
      if (result.success) {
        toast.success(
          t('providers.notifications.modelsSynced', {
            count: result.count ?? 0,
            family: t(`providers.family.labels.${family}`)
          })
        )
      } else {
        toast.error(result.error || result.message || t('providers.notifications.modelsSyncFailed'))
      }
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.modelsSyncFailed')))
  })
}

export function useSaveProviderModelState(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<SaveProviderModelStateInput, 'providerId'>) =>
      providersClient.saveModelState({ providerId, ...input }),
    onSuccess: (workspace, input) => {
      queryClient.setQueryData(providerKeys.workspace(providerId), workspace)
      queryClient.setQueryData<ProviderSetupState[]>(providerKeys.setups(), (setups) =>
        patchSetupsWithWorkspace(
          setups,
          workspace,
          input.isDefault && input.enabled !== false ? input.family : undefined
        )
      )
      invalidateProvider(queryClient, providerId)
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.modelStateSaveFailed')))
  })
}

export function useAddCustomProviderModel(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<SaveProviderModelStateInput, 'providerId' | 'isCustom'>) =>
      providersClient.saveModelState({ providerId, ...input, isCustom: true }),
    onSuccess: (workspace) => {
      queryClient.setQueryData(providerKeys.workspace(providerId), workspace)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.models.add.success'))
    },
    onError: (error) => toast.error(errorMessage(error, t('providers.models.add.error')))
  })
}

export function useDeleteProviderModel(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { family: ModelFamily; modelId: string }) =>
      providersClient.saveModelState({ providerId, ...input, delete: true }),
    onSuccess: (workspace) => {
      queryClient.setQueryData(providerKeys.workspace(providerId), workspace)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.models.delete.success'))
    },
    onError: (error) => toast.error(errorMessage(error, t('providers.models.delete.error')))
  })
}

export function useSaveProviderDefaults(providerId: ProviderId) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<SaveProviderDefaultsInput, 'providerId'>) =>
      providersClient.saveDefaults({ providerId, ...input }),
    onSuccess: (workspace) => {
      queryClient.setQueryData(providerKeys.workspace(providerId), workspace)
      invalidateProvider(queryClient, providerId)
      toast.success(t('providers.notifications.defaultsSaved'))
    },
    onError: (error) =>
      toast.error(errorMessage(error, t('providers.notifications.defaultsSaveFailed')))
  })
}
