import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"

function Loader({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="loader"
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Loader }