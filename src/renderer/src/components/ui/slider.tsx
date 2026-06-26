import { Slider as SliderPrimitive } from '@base-ui/react/slider'

import { cn } from '@/lib/utils'

function Slider({ className, ...props }: SliderPrimitive.Root.Props<number>): React.JSX.Element {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn('relative flex w-full items-center select-none', className)}
      {...props}
    >
      <SliderPrimitive.Control className="flex w-full items-center py-2">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-input">
          <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
          <SliderPrimitive.Thumb className="size-4 rounded-full border-2 border-primary bg-background shadow-md transition-transform outline-none hover:scale-110 focus-visible:ring-3 focus-visible:ring-ring/50 data-dragging:scale-110" />
        </SliderPrimitive.Track>
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
