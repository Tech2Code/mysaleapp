import type { Order } from "@/features/orders/types"
import { paymentDisplay } from "@/features/orders/types"
import { gstActive, gstIncluded, invoiceTitle } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatDate, formatMoney } from "@/lib/format"

/**
 * Printable bill for one order. Prices already include any GST, so this only shows how much tax is inside.
 * Shop not registered → "Bill of Supply" (no tax). Registered → "Tax Invoice" with GSTIN and the GST included.
 * Colours follow the theme on screen; globals.css prints it black on white.
 */
export function InvoiceDocument({ order, shop }: { order: Order; shop: StoreSettings }) {
  // Prefer the immutable tax/seller snapshot recorded when the order was created; fall back to live settings for older orders.
  const snap = order.taxSnapshot
  const effectiveShop = snap
    ? {
        gstRegistered: snap.gstRegistered,
        gstin: snap.gstin,
        gstRate: snap.gstRate,
        legalName: snap.legalName,
        businessAddress: snap.businessAddress,
        shopName: snap.shopName || shop.shopName,
        city: snap.city,
        region: snap.region,
        phone: snap.phone,
        email: snap.email,
      }
    : shop
  const title = invoiceTitle(effectiveShop)
  const taxed = gstActive(effectiveShop)
  const tax = taxed ? gstIncluded(order.total, effectiveShop.gstRate) : null
  const sellerName = effectiveShop.legalName || effectiveShop.shopName
  const sellerAddress = effectiveShop.businessAddress || [effectiveShop.city, effectiveShop.region].filter(Boolean).join(", ")
  const payment = paymentDisplay(order.status, order.paymentStatus, order.paymentMethod, {
    refundedAmount: order.refundedAmount,
    paidAmount: order.paymentAmount ?? order.total,
  })

  return (
    <article data-ui="shared/InvoiceDocument" data-invoice className="mx-auto w-full max-w-3xl rounded-2xl border bg-card p-5 text-foreground sm:p-8" aria-label={`${title} ${order.orderCode}`}>
      <header data-ui="shared/InvoiceDocument/header-flex" className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
        <div data-ui="shared/InvoiceDocument/div" className="min-w-0">
          <h1 data-ui="shared/InvoiceDocument/h1" className="font-sans text-2xl font-semibold">{title}</h1>
          <p data-ui="shared/InvoiceDocument/p" className="mt-1 text-sm text-muted-foreground">
            No. <span data-ui="shared/InvoiceDocument/span" className="font-mono font-semibold text-foreground">{order.orderCode}</span> · {formatDate(order.createdAt)}
          </p>
        </div>
        <div data-ui="shared/InvoiceDocument/div-2" className="text-sm sm:text-right">
          <p data-ui="shared/InvoiceDocument/p-2" className="font-semibold">{sellerName}</p>
          {sellerAddress && <p data-ui="shared/InvoiceDocument/p-3" className="max-w-64 text-muted-foreground">{sellerAddress}</p>}
          {effectiveShop.phone && <p data-ui="shared/InvoiceDocument/p-4" className="text-muted-foreground">{effectiveShop.phone}</p>}
          {effectiveShop.email && <p data-ui="shared/InvoiceDocument/p-5" className="text-muted-foreground">{effectiveShop.email}</p>}
          {taxed && effectiveShop.gstin && <p data-ui="shared/InvoiceDocument/p-6" className="mt-1 font-mono text-xs font-semibold">GSTIN: {effectiveShop.gstin}</p>}
        </div>
      </header>

      <section data-ui="shared/InvoiceDocument/section-billed-to" className="grid gap-4 border-b py-5 text-sm sm:grid-cols-2" aria-label="Billed to">
        <div data-ui="shared/InvoiceDocument/div-3">
          <h2 data-ui="shared/InvoiceDocument/h2-billed-to" className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase">Billed to</h2>
          <p data-ui="shared/InvoiceDocument/p-7" className="mt-1 font-semibold">{order.customerName}</p>
          <p data-ui="shared/InvoiceDocument/p-8" className="text-muted-foreground">{order.address}</p>
          <p data-ui="shared/InvoiceDocument/p-9" className="text-muted-foreground">{order.city} - {order.pincode}</p>
          <p data-ui="shared/InvoiceDocument/p-10" className="text-muted-foreground">{order.phone}</p>
        </div>
        <div data-ui="shared/InvoiceDocument/div-4" className="sm:text-right">
          <h2 data-ui="shared/InvoiceDocument/h2-payment" className="font-sans text-xs font-semibold tracking-wider text-muted-foreground uppercase">Payment</h2>
          <p data-ui="shared/InvoiceDocument/p-11" className="mt-1 font-semibold">{payment.label}</p>
          {order.returnStage?.badge && order.returnStage.key !== "rejected" && (
            <p data-ui="shared/InvoiceDocument/p-12" className="text-xs text-muted-foreground">Return: {order.returnStage.customerLabel}</p>
          )}
          {order.paymentReference && <p data-ui="shared/InvoiceDocument/p-13" className="font-mono text-xs text-muted-foreground">Ref: {order.paymentReference}</p>}
        </div>
      </section>

      <div data-ui="shared/InvoiceDocument/div-5" className="overflow-x-auto">
        <table data-ui="shared/InvoiceDocument/table" className="w-full min-w-[480px] border-collapse text-sm">
          <caption data-ui="shared/InvoiceDocument/caption" className="sr-only">Items in this order</caption>
          <thead data-ui="shared/InvoiceDocument/thead">
            <tr data-ui="shared/InvoiceDocument/tr" className="border-b text-left text-xs tracking-wider text-muted-foreground uppercase">
              <th data-ui="shared/InvoiceDocument/th-item" scope="col" className="py-3 pr-2 font-semibold">Item</th>
              <th data-ui="shared/InvoiceDocument/th-qty" scope="col" className="px-2 py-3 text-right font-semibold">Qty</th>
              <th data-ui="shared/InvoiceDocument/th-rate" scope="col" className="px-2 py-3 text-right font-semibold">Rate</th>
              <th data-ui="shared/InvoiceDocument/th-amount" scope="col" className="py-3 pl-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody data-ui="shared/InvoiceDocument/tbody">
            {order.items.map((i) => (
              <tr data-ui="shared/InvoiceDocument/tr-2" key={i.productId} className="border-b">
                <td data-ui="shared/InvoiceDocument/td" className="py-3 pr-2">{i.name}</td>
                <td data-ui="shared/InvoiceDocument/td-2" className="px-2 py-3 text-right tabular-nums">{i.quantity}</td>
                <td data-ui="shared/InvoiceDocument/td-3" className="px-2 py-3 text-right tabular-nums">{formatMoney(i.price)}</td>
                <td data-ui="shared/InvoiceDocument/td-4" className="py-3 pl-2 text-right tabular-nums">{formatMoney(i.price * i.quantity)}</td>
              </tr>
            ))}
            {order.extraFees.map((f, idx) => (
              <tr data-ui="shared/InvoiceDocument/tr-3" key={`${f.productId ?? "fee"}-${idx}`} className="border-b">
                <td data-ui="shared/InvoiceDocument/td-5" className="py-3 pr-2" colSpan={3}>
                  {f.label}
                  {f.productName ? ` (${f.productName})` : ""}
                </td>
                <td data-ui="shared/InvoiceDocument/td-6" className="py-3 pl-2 text-right tabular-nums">{formatMoney(f.amount)}</td>
              </tr>
            ))}
            <tr data-ui="shared/InvoiceDocument/tr-4" className="border-b">
              <td data-ui="shared/InvoiceDocument/td-7" className="py-3 pr-2" colSpan={3}>Delivery</td>
              <td data-ui="shared/InvoiceDocument/td-8" className="py-3 pl-2 text-right tabular-nums">{order.shippingFee > 0 ? formatMoney(order.shippingFee) : "Free"}</td>
            </tr>
          </tbody>
          <tfoot data-ui="shared/InvoiceDocument/tfoot">
            <tr data-ui="shared/InvoiceDocument/tr-5">
              <th data-ui="shared/InvoiceDocument/th-total" scope="row" colSpan={3} className="pt-4 pr-2 text-right text-base font-semibold">Total</th>
              <td data-ui="shared/InvoiceDocument/td-9" className="pt-4 pl-2 text-right text-base font-semibold tabular-nums">{formatMoney(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {tax ? (
        <section data-ui="shared/InvoiceDocument/section-gst-included" className="mt-5 rounded-xl border p-4 text-sm" aria-label="GST included">
          <p data-ui="shared/InvoiceDocument/p-flex" className="flex justify-between gap-4"><span data-ui="shared/InvoiceDocument/span-2">Taxable value</span><span data-ui="shared/InvoiceDocument/span-3" className="tabular-nums">{formatMoney(tax.taxable)}</span></p>
          <p data-ui="shared/InvoiceDocument/p-flex-2" className="mt-1 flex justify-between gap-4">
            <span data-ui="shared/InvoiceDocument/span-4">GST @ {effectiveShop.gstRate}% (included in the total)</span>
            <span data-ui="shared/InvoiceDocument/span-5" className="tabular-nums">{formatMoney(tax.gst)}</span>
          </p>
          <p data-ui="shared/InvoiceDocument/p-14" className="mt-2 text-xs text-muted-foreground">Prices are inclusive of GST. CGST + SGST or IGST applies depending on the delivery state.</p>
        </section>
      ) : (
        <p data-ui="shared/InvoiceDocument/p-15" className="mt-5 text-xs text-muted-foreground">
          {sellerName} is not registered under GST, so no tax is charged. This is a Bill of Supply, not a Tax Invoice.
        </p>
      )}

      <footer data-ui="shared/InvoiceDocument/footer" className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
        Thank you for shopping with {effectiveShop.shopName}. This is a computer-generated document.
      </footer>
    </article>
  )
}
