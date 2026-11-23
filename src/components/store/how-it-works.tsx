import { BadgeIndianRupeeIcon, HeartHandshakeIcon, ShoppingBagIcon, TruckIcon } from "lucide-react"
import { FadeIn } from "@/components/shared/motion"

const steps = [
  { icon: ShoppingBagIcon, title: "Pick what you love", text: "Add what you love to your cart — no account needed." },
  { icon: BadgeIndianRupeeIcon, title: "Pay by UPI", text: "Pay securely with any UPI app and share the reference number." },
  { icon: HeartHandshakeIcon, title: "We confirm & craft", text: "Once your payment is verified, we confirm and start crafting." },
  { icon: TruckIcon, title: "Delivered with care", text: "Track every step online with your order code." },
]

export function HowItWorks() {
  return (
    <section data-ui="store/HowItWorks" className="container-page" aria-labelledby="how-title">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <p data-ui="store/HowItWorks/p" className="text-xs font-semibold tracking-widest text-primary uppercase sm:text-sm">Simple ordering</p>
        <h2 data-ui="store/HowItWorks/h2-from-our-hands-to-your" id="how-title" className="mt-1.5 text-2xl font-semibold sm:mt-3 sm:text-4xl">
          From our hands to yours in 4 easy steps
        </h2>
      </FadeIn>
      <ol data-ui="store/HowItWorks/ol-grid" className="mt-6 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-5 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li data-ui="store/HowItWorks/li" key={s.title}>
            <FadeIn delay={i * 0.06} className="relative h-full rounded-2xl border border-border/80 bg-card p-4 transition-shadow hover:shadow-md sm:p-6">
              <div data-ui="store/HowItWorks/div-flex" className="flex items-center justify-between gap-2">
                <div data-ui="store/HowItWorks/div-grid" className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary sm:size-11">
                  <s.icon data-ui="store/HowItWorks/s.icon" className="size-5" aria-hidden />
                </div>
                <span data-ui="store/HowItWorks/span" className="font-heading text-xs font-semibold tracking-wider text-muted-foreground tabular-nums">
                  0{i + 1}
                </span>
              </div>
              <h3 data-ui="store/HowItWorks/h3" className="mt-4 font-sans text-sm font-semibold sm:mt-5 sm:text-base">{s.title}</h3>
              <p data-ui="store/HowItWorks/p-2" className="mt-1 text-xs/relaxed text-muted-foreground sm:mt-1.5 sm:text-sm/relaxed">{s.text}</p>
            </FadeIn>
          </li>
        ))}
      </ol>
    </section>
  )
}
