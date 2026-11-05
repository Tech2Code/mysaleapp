import { ArrowLeftIcon, PhoneIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminNoteForm, OrderStatusControl } from "@/components/admin/order-controls"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { StatusBadge } from "@/components/shared/status-badge"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { ProductImage } from "@/components/store/product-image"
import { getOrderById } from "@/features/orders/admin-queries"
import { whatsappLink } from "@/features/orders/whatsapp"
import { formatDateTime, formatPrice } from "@/lib/format"

export const metadata: Metadata = { title: "Order details" }

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params
  const order = await getOrderById(id)
  if (!order) notFound()

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold sm:text-3xl">{order.orderCode}</h1>
        <StatusBadge status={order.status} className="text-sm" />
        <span className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</span>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card">
            <h2 className="border-b p-5 font-sans text-lg font-semibold">Items</h2>
            <ul className="divide-y">
              {order.items.map((i) => (
                <li key={i.productId} className="flex items-center gap-4 p-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                    <ProductImage src={i.image} alt={i.name} sizes="56px" />
                  </div>
                  <div className="flex-1">
                    <Link href={`/products/${i.slug}`} target="_blank" className="font-medium hover:text-primary">
                      {i.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(i.price)} × {i.quantity}
                    </p>
                  </div>
                  <span className="font-semibold">{formatPrice(i.price * i.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between p-5 text-lg font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(order.subtotal)}</span>
              </li>
            </ul>
          </section>

          <section className="grid gap-6 rounded-2xl border bg-card p-5 sm:grid-cols-2">
            <div>
              <h2 className="font-sans text-lg font-semibold">Customer</h2>
              <p className="mt-2 font-medium">{order.customerName}</p>
              <p className="text-sm text-muted-foreground">+91 {order.phone}</p>
              <p className="mt-1 text-xs text-muted-foreground">{order.userId ? "Signed-in customer" : "Guest checkout"}</p>
              <div className="mt-3 flex gap-2">
                <a
                  href={whatsappLink(`91${order.phone}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-whatsapp px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <WhatsAppIcon className="size-3.5" /> WhatsApp
                </a>
                <a href={`tel:+91${order.phone}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold">
                  <PhoneIcon className="size-3.5" /> Call
                </a>
              </div>
            </div>
            <div>
              <h2 className="font-sans text-lg font-semibold">Ship to</h2>
              <p className="mt-2 text-sm">{order.address}</p>
              <p className="text-sm">
                {order.city} - {order.pincode}
              </p>
              {order.note && (
                <p className="mt-3 rounded-xl bg-secondary/70 p-3 text-sm">
                  <span className="font-semibold">Customer note:</span> {order.note}
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-5">
            <OrderStatusControl
              orderId={order.id}
              orderCode={order.orderCode}
              customerName={order.customerName}
              phone={order.phone}
              status={order.status}
            />
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="mb-4 font-sans text-lg font-semibold">Timeline</h2>
            <OrderTimeline status={order.status} history={order.history} />
          </section>
          <section className="rounded-2xl border bg-card p-5">
            <AdminNoteForm orderId={order.id} note={order.adminNote} />
          </section>
        </aside>
      </div>
    </>
  )
}
