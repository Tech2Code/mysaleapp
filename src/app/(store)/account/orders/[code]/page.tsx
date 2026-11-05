import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { StatusBadge } from "@/components/shared/status-badge"
import { ProductImage } from "@/components/store/product-image"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyOrder } from "@/features/orders/queries"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { formatDate, formatPrice } from "@/lib/format"

async function OrderDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const order = await getMyOrder(code)
  if (!order) notFound()

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-5">
          <div>
            <h2 className="font-mono text-2xl font-semibold">{order.orderCode}</h2>
            <p className="text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} className="text-sm" />
        </div>

        <ul className="divide-y rounded-3xl border bg-card">
          {order.items.map((i) => (
            <li key={i.productId} className="flex items-center gap-4 p-4">
              <Link href={`/products/${i.slug}`} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                <ProductImage src={i.image} alt={i.name} sizes="64px" />
              </Link>
              <div className="flex-1">
                <Link href={`/products/${i.slug}`} className="font-medium hover:text-primary">
                  {i.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(i.price)} × {i.quantity}
                </p>
              </div>
              <span className="font-semibold">{formatPrice(i.price * i.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between p-4 font-semibold">
            <span>Total</span>
            <span className="font-heading text-xl">{formatPrice(order.subtotal)}</span>
          </li>
        </ul>

        <div className="rounded-3xl border bg-card p-5 text-sm">
          <h3 className="mb-2 font-sans font-semibold">Delivery address</h3>
          <p>{order.customerName} · {order.phone}</p>
          <p className="text-muted-foreground">
            {order.address}, {order.city} - {order.pincode}
          </p>
          {order.note && <p className="mt-2 text-muted-foreground">Note: {order.note}</p>}
        </div>
      </div>

      <aside className="h-fit space-y-5 rounded-3xl border bg-card p-6">
        <h3 className="font-sans font-semibold">Order progress</h3>
        <OrderTimeline status={order.status} history={order.history} />
        <a
          href={shopWhatsappLink(`Hi! I have a question about my order ${order.orderCode}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp text-sm font-semibold text-white"
        >
          <WhatsAppIcon className="size-4" /> Ask about this order
        </a>
      </aside>
    </div>
  )
}

export default function MyOrderPage({ params }: PageProps<"/account/orders/[code]">) {
  return (
    <section className="space-y-6">
      <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <OrderDetail params={params} />
      </Suspense>
    </section>
  )
}
