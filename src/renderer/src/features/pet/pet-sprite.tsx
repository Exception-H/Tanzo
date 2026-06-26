import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  CODEX_PET_ANIMATIONS,
  CODEX_PET_ATLAS,
  PET_STATE_ANIMATION_MAP,
  type CodexPetAnimationName,
  type PetAsset,
  type PetPresenceState
} from '@shared/pet'

interface PetSpriteProps {
  asset: PetAsset
  state: PetPresenceState
  animationName?: CodexPetAnimationName
  scale?: number
}

export function PetSprite({
  asset,
  state,
  animationName,
  scale = 1
}: PetSpriteProps): React.JSX.Element {
  const resolvedAnimationName = animationName ?? PET_STATE_ANIMATION_MAP[state]
  const animation = CODEX_PET_ANIMATIONS[resolvedAnimationName]
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    queueMicrotask(() => setFrame(0))
    let cancelled = false
    let currentFrame = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const advance = (): void => {
      const duration = animation.durationsMs[currentFrame] ?? animation.durationsMs[0] ?? 120
      timer = setTimeout(() => {
        if (cancelled) return
        currentFrame = (currentFrame + 1) % animation.durationsMs.length
        setFrame(currentFrame)
        advance()
      }, duration)
    }

    advance()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [animation])

  const style = useMemo<CSSProperties>(() => {
    return {
      width: `${CODEX_PET_ATLAS.cellWidth * scale}px`,
      height: `${CODEX_PET_ATLAS.cellHeight * scale}px`,
      backgroundImage: `url(${asset.spritesheetDataUrl})`,
      backgroundSize: `${CODEX_PET_ATLAS.sheetWidth * scale}px ${CODEX_PET_ATLAS.sheetHeight * scale}px`,
      backgroundPosition: `${-frame * CODEX_PET_ATLAS.cellWidth * scale}px ${
        -animation.row * CODEX_PET_ATLAS.cellHeight * scale
      }px`
    }
  }, [asset.spritesheetDataUrl, animation.row, frame, scale])

  return <div className="pet-sprite" style={style} />
}
