import type {
  ModelFamily,
  ProviderConfig,
  ProviderSetupState,
  StoredProviderModel
} from '@/common/contracts'

export const FAMILY_ORDER: ModelFamily[] = [
  'language',
  'embedding',
  'image',
  'transcription',
  'speech'
]

export function providerFamilyTab(family: ModelFamily): `family:${ModelFamily}` {
  return `family:${family}`
}

export function isReadyProvider(setup?: ProviderSetupState): boolean {
  return setup?.connection.status === 'connected' && setup.configurationStatus === 'ready'
}

export function isConfiguredProvider(setup?: ProviderSetupState): boolean {
  return setup?.connection.status === 'connected' || setup?.connection.status === 'expired'
}

export function providerStatusLabel(status: ProviderSetupState['configurationStatus']): string {
  switch (status) {
    case 'ready':
      return 'providers.status.ready'
    case 'connected_no_models':
      return 'providers.status.connectedNoModels'
    case 'models_not_enabled':
      return 'providers.status.modelsNotEnabled'
    case 'not_connected':
      return 'common.status.notConfigured'
  }
}

export function sortedFamilies(provider: ProviderConfig): ModelFamily[] {
  return FAMILY_ORDER.filter((family) => provider.families[family]?.supported)
}

export function modelMeta(model: StoredProviderModel): string[] {
  const values: string[] = []
  if (model.contextWindow) values.push(`${model.contextWindow.toLocaleString()} ctx`)
  if (model.maxOutput) values.push(`${model.maxOutput.toLocaleString()} out`)
  if (model.dimensions) values.push(`${model.dimensions.toLocaleString()} dims`)
  if (model.maxImagesPerCall) values.push(`${model.maxImagesPerCall} images`)
  if (model.supportedSizes?.length) values.push(model.supportedSizes.slice(0, 3).join(', '))
  if (model.supportedFormats?.length) values.push(model.supportedFormats.slice(0, 3).join(', '))
  return values
}
