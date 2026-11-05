import { BadgeIndianRupeeIcon, HeartHandshakeIcon, ShoppingBagIcon, TruckIcon } from "lucide-react"
import { FadeIn } from "@/components/shared/motion"

const steps = [
  { icon: ShoppingBagIcon, title: "Pick what you love", text: "Add handmade pieces to your cart — no account needed." },
  { icon: BadgeIndianRupeeIcon, title: "Pay by UPI", text: "Pay securely with any UPI app and share the reference number." },
  { icon: HeartHandshakeIcon, title: "We confirm & craft", text: "Once your payment is verified, we confirm and start crafting." },
  { icon: TruckIcon, title: "Delivered with care", text: "Track every step online with your order code." },
]

export function HowItWorks() {
  return (
    <section data-ui="store/HowItWorks" className="container-page" aria-labelledby="how-title">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <p data-ui="store/HowItWorks/p" className="text-sm font-semibold tracking-widest text-primary uppercase">Simple ordering</p>
        <h2 data-ui="store/HowItWorks/h2-from-our-hands-to-your" id="how-title" className="mt-3 text-3xl font-semibold sm:text-4xl">
          From our hands to yours in 4 easy steps
        </h2>
      </FadeIn>
      <ol data-ui="store/HowItWorks/ol-grid" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li data-ui="store/HowItWorks/li" key={s.title}>
            <FadeIn delay={i * 0.08} className="relative h-full rounded-3xl border bg-card p-6 transition-shadow hover:shadow-lg">
              <span data-ui="store/HowItWorks/span-absolute" className="absolute top-5 right-6 font-heading text-5xl font-semibold text-primary/10">{i + 1}</span>
              <div data-ui="store/HowItWorks/div-grid" className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-primary to-[oklch(0.6_0.16_15)] text-primary-foreground shadow-lg shadow-primary/25">
                <s.icon data-ui="store/HowItWorks/s.icon" className="size-6" />
              </div>
              <h3 data-ui="store/HowItWorks/h3" className="mt-5 font-sans text-lg font-semibold">{s.title}</h3>
              <p data-ui="store/HowItWorks/p-2" className="mt-1.5 text-sm/relaxed  text-muted-foreground">{s.text}</p>
            </FadeIn>
          </li>
        ))}
      </ol>
    </section>
  )
}
