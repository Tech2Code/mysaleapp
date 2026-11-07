import { ChevronDownIcon } from "lucide-react"
import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react"

type ItemProps = { title: string; children: ReactNode; defaultOpen?: boolean; name?: string }

/**
 * Collapsible section built on the native <details> element: keyboard accessible, works without JavaScript.
 * Items inside an <Accordion> share a `name`, so the browser keeps only one open at a time.
 */
export function AccordionItem({ title, children, defaultOpen = false, name }: ItemProps) {
  return (
    <details data-ui="shared/AccordionItem" name={name} open={defaultOpen} className="group border-b last:border-b-0">
      <summary data-ui="shared/AccordionItem/summary-flex" className="flex cursor-pointer list-none items-center justify-between gap-3 py-4 text-sm font-semibold marker:hidden hover:text-primary">
        {title}
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" aria-hidden />
      </summary>
      <div data-ui="shared/AccordionItem/div" className="pb-5 text-sm/relaxed  text-muted-foreground">{children}</div>
    </details>
  )
}

/** One item open at a time: opening one closes the other. */
export function Accordion({ children }: { children: ReactNode }) {
  const group = useId()
  return (
    <div data-ui="shared/Accordion" className="rounded-3xl border bg-card px-5 sm:px-6">
      {Children.map(children, (child) =>
        isValidElement<ItemProps>(child) ? cloneElement(child as ReactElement<ItemProps>, { name: group }) : child
      )}
    </div>
  )
}
