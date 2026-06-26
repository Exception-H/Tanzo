import { useTranslation } from 'react-i18next'

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value
  )
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`
}

export function useTimestampFormatter(): (ms: number | null) => string {
  const { i18n } = useTranslation()
  const formatter = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  return (ms) => (ms === null ? '—' : formatter.format(new Date(ms)))
}
