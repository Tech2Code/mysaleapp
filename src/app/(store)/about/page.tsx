import { HandHeartIcon, LeafIcon, SparklesIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { FadeIn } from "@/components/shared/motion"
import { PageHeader } from "@/components/store/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"
import { cn } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Our story",
    description: `${shop.shopName} brings you handmade gifts and decor crafted by artisans${shop.city ? ` in ${shop.city}` : ""}, India.`,
    path: "/about",
  })
}

const values = [
  { icon: HandHeartIcon, title: "Made by hand", text: "Every piece is shaped, painted or woven by a real person — never mass-produced." },
  { icon: LeafIcon, title: "Mindful materials", text: "Natural clay, cotton, jute, soy wax and wood, sourced responsibly wherever we can." },
  { icon: SparklesIcon, title: "Personal service", text: "Chat with us on WhatsApp for questions, custom orders and delivery updates." },
]

export default async function AboutPage() {
  const shop = await getStoreSettings()

  return (
    <>
      <PageHeader
        title="Our story"
        description={`${shop.shopName} began with a simple idea: the things we live with should carry a little bit of someone's heart.`}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "About" }]}
      />
      <div data-ui="page:/about/div" className="container-page space-y-10 sm:space-y-16 pt-8 sm:pt-12">
        <FadeIn className="mx-auto max-w-3xl space-y-5 text-lg/relaxed  text-muted-foreground">
          <p data-ui="page:/about/p">
            We work with small studios and independent artisans{shop.city ? ` around ${shop.city}` : ""} to bring you decor and
            gifts that feel personal. Each piece is made in small batches, which means tiny variations in colour and texture —
            that&apos;s the beauty of handmade.
          </p>
          <p data-ui="page:/about/p-2">
            Have something specific in mind? We love custom orders — personalised names, colours and bulk gifting for
            weddings and festivals.
          </p>
        </FadeIn>
        <div data-ui="page:/about/div-grid" className="grid gap-5 md:grid-cols-3">
          {values.map((v, i) => (
            <FadeIn key={v.title} delay={i * 0.08} className="rounded-3xl border bg-card p-7">
              <v.icon data-ui="page:/about/v.icon" className="size-8 text-primary" />
              <h2 data-ui="page:/about/h2" className="mt-4 font-sans text-xl font-semibold">{v.title}</h2>
              <p data-ui="page:/about/p-3" className="mt-2 text-muted-foreground">{v.text}</p>
            </FadeIn>
          ))}
        </div>
        <div data-ui="page:/about/div-2" className="text-center">
          <Link data-ui="page:/about/Link-explore-the-collection" href="/products" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-5 sm:px-8 text-base")}>
            Explore the collection
          </Link>
        </div>
      </div>
    </>
  )
}
