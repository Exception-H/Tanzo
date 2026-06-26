import { ImageIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  WALLPAPER_BLUR_MAX,
  WALLPAPER_OPACITY_MAX,
  WALLPAPER_OPACITY_MIN,
  WALLPAPER_OVERLAY_MAX,
  type WallpaperOverlay
} from '@shared/preferences'
import {
  clearWallpaper,
  patchPreferences,
  pickWallpaper,
  usePreferences
} from '@/common/preferences'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { SectionCard } from '../shared/settings-primitives'

const OVERLAY_ORDER: WallpaperOverlay[] = ['none', 'dark', 'light']

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  disabled: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="flex min-h-11 w-full items-center gap-4 px-3 py-2.5">
      <span className="w-20 shrink-0 text-[0.8125rem] text-foreground/82">{label}</span>
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(next) => {
          if (typeof next === 'number') onChange(next)
        }}
      />
      <span className="w-10 shrink-0 text-right text-[0.6875rem] tabular-nums text-foreground/52">
        {display}
      </span>
    </div>
  )
}

export function WallpaperSection() {
  const { t } = useTranslation()
  const wallpaper = usePreferences().wallpaper
  const active = wallpaper.assetPath !== null

  return (
    <SectionCard
      icon={<ImageIcon className="size-3" />}
      title={t('settings.theme.wallpaper.title', { defaultValue: 'Wallpaper' })}
      description={t('settings.theme.wallpaper.description', {
        defaultValue: 'Set a background image behind the interface.'
      })}
      action={
        <>
          {active ? (
            <Button variant="ghost" size="sm" className="h-7" onClick={() => void clearWallpaper()}>
              {t('settings.theme.wallpaper.clear', { defaultValue: 'Remove' })}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="h-7" onClick={() => void pickWallpaper()}>
            {active
              ? t('settings.theme.wallpaper.replace', { defaultValue: 'Replace' })
              : t('settings.theme.wallpaper.choose', { defaultValue: 'Choose image' })}
          </Button>
        </>
      }
    >
      <SliderRow
        label={t('settings.theme.wallpaper.opacity', { defaultValue: 'Opacity' })}
        value={wallpaper.opacity}
        min={WALLPAPER_OPACITY_MIN}
        max={WALLPAPER_OPACITY_MAX}
        step={0.05}
        display={`${Math.round(wallpaper.opacity * 100)}%`}
        disabled={!active}
        onChange={(opacity) => void patchPreferences({ wallpaper: { opacity } })}
      />
      <SliderRow
        label={t('settings.theme.wallpaper.blur', { defaultValue: 'Blur' })}
        value={wallpaper.blur}
        min={0}
        max={WALLPAPER_BLUR_MAX}
        step={1}
        display={`${Math.round(wallpaper.blur)}px`}
        disabled={!active}
        onChange={(blur) => void patchPreferences({ wallpaper: { blur } })}
      />
      <div className="flex min-h-11 w-full items-center gap-4 px-3 py-2.5">
        <span className="w-20 shrink-0 text-[0.8125rem] text-foreground/82">
          {t('settings.theme.wallpaper.overlay.title', { defaultValue: 'Overlay' })}
        </span>
        <div className="flex flex-1 gap-1">
          {OVERLAY_ORDER.map((option) => (
            <Button
              key={option}
              variant={wallpaper.overlay === option ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 flex-1"
              disabled={!active}
              onClick={() => void patchPreferences({ wallpaper: { overlay: option } })}
            >
              {t(`settings.theme.wallpaper.overlay.options.${option}`, { defaultValue: option })}
            </Button>
          ))}
        </div>
      </div>
      {wallpaper.overlay !== 'none' ? (
        <SliderRow
          label={t('settings.theme.wallpaper.overlay.strength', { defaultValue: 'Tint' })}
          value={wallpaper.overlayStrength}
          min={0}
          max={WALLPAPER_OVERLAY_MAX}
          step={0.05}
          display={`${Math.round(wallpaper.overlayStrength * 100)}%`}
          disabled={!active}
          onChange={(overlayStrength) => void patchPreferences({ wallpaper: { overlayStrength } })}
        />
      ) : null}
    </SectionCard>
  )
}
