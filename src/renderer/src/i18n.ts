import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { ElectronSystemPreferences } from '@shared/system'
import { createLogger } from '@/common/logger'
import { en } from '@/locales/en'
import { zhCN } from '@/locales/zh-CN'

const log = createLogger('renderer.i18n')

export const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' }
] as const

const resources = {
  en,
  'zh-CN': zhCN
} as const

function resolveLanguage(language?: string): 'en' | 'zh-CN' {
  return language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

let initPromise: Promise<void> | null = null

export function initializeI18n(systemPreferences?: ElectronSystemPreferences): Promise<void> {
  if (initPromise) {
    return initPromise
  }

  const preferredLanguage =
    systemPreferences?.preferredLanguages.find((language) => language.length > 0) ??
    systemPreferences?.locale ??
    'en'

  const options = {
    resources,
    lng: resolveLanguage(preferredLanguage),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((item) => item.value),
    interpolation: {
      escapeValue: false
    }
  } as const

  initPromise = i18n
    .use(initReactI18next)
    .init(options)
    .then(() => undefined)
    .catch(async (error) => {
      log.error('failed to initialize i18n; falling back to English', error)
      try {
        await i18n.init({ ...options, lng: 'en' })
      } catch (fallbackError) {
        log.error('failed to initialize fallback i18n', fallbackError)
        initPromise = null
      }
    })

  return initPromise
}

export function getLocale(language?: string) {
  if (resolveLanguage(language) === 'zh-CN') {
    return 'zh-CN'
  }
  return 'en-US'
}

export default i18n
