// 滚动区域封装：启用 iOS 惯性滚动（-webkit-overflow-scrolling: touch）和平移手势
import * as React from "react"
import { cn } from "@/lib/utils"

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      <div
        className="h-full w-full rounded-[inherit] overflow-auto"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {children}
      </div>
    </div>
  )
)
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }
