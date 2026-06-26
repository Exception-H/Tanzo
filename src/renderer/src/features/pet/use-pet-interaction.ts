import { useEffect, type RefObject } from 'react'

const DRAG_THRESHOLD = 4
const DOUBLE_CLICK_MS = 320

interface PetInteractionDeps {
  setHitRect: (rect: { x: number; y: number; width: number; height: number } | null) => void
  setDragging: (dragging: boolean) => void
  move: (delta: { dx: number; dy: number }) => void
  onClick: () => void
  onDoubleClick?: () => void
  onDragEnd: () => void
}

export function usePetInteraction(
  hitRef: RefObject<HTMLElement | null>,
  dragRef: RefObject<HTMLElement | null>,
  deps: PetInteractionDeps,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return
    const hitElement = hitRef.current
    const dragElement = dragRef.current
    if (!hitElement || !dragElement) return

    let dragging = false
    let pointerDown = false
    let movedDistance = 0
    let lastClickAt = 0

    const reportRect = (): void => {
      const rect = hitElement.getBoundingClientRect()
      deps.setHitRect({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      })
    }

    const onPointerDown = (event: PointerEvent): void => {
      pointerDown = true
      dragging = false
      movedDistance = 0
      dragElement.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (!pointerDown) return
      movedDistance += Math.abs(event.movementX) + Math.abs(event.movementY)
      if (!dragging && movedDistance > DRAG_THRESHOLD) {
        dragging = true
        deps.setDragging(true)
      }
      if (dragging) deps.move({ dx: event.movementX, dy: event.movementY })
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (!pointerDown) return
      pointerDown = false
      if (dragElement.hasPointerCapture(event.pointerId)) {
        dragElement.releasePointerCapture(event.pointerId)
      }
      if (dragging) {
        dragging = false
        deps.setDragging(false)
        deps.onDragEnd()
      } else {
        const now = Date.now()
        if (deps.onDoubleClick && now - lastClickAt <= DOUBLE_CLICK_MS) {
          lastClickAt = 0
          deps.onDoubleClick()
        } else {
          lastClickAt = now
          deps.onClick()
        }
      }
    }

    reportRect()
    const observer = new ResizeObserver(reportRect)
    observer.observe(hitElement)

    dragElement.addEventListener('pointerdown', onPointerDown)
    dragElement.addEventListener('pointermove', onPointerMove)
    dragElement.addEventListener('pointerup', onPointerUp)

    return () => {
      observer.disconnect()
      deps.setHitRect(null)
      dragElement.removeEventListener('pointerdown', onPointerDown)
      dragElement.removeEventListener('pointermove', onPointerMove)
      dragElement.removeEventListener('pointerup', onPointerUp)
    }
  }, [hitRef, dragRef, deps, enabled])
}
