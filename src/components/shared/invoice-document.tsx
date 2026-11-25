import type { Order } from "@/features/orders/types"
import { paymentDisplay } from "@/features/orders/types"
import { gstActive, gstIncluded, invoiceTitle } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatDate, formatMoney } from "@/lib/format"
import styles from "./shared.module.css"

/**
 * Printable bill for one order. Prices already include any GST, so this only shows how much tax is inside.
 * Shop not registered → "Bill of Supply" (no tax). Registered → "Tax Invoice" with GSTIN and the GST included.
 * Colours follow the theme on screen; globals.css prints it black on white.
 */
export function InvoiceDocument({ order, shop }: { order: Order; shop: StoreSettings }) {
  // Always use live Store Settings for seller contact & address details so any update in Settings reflects
  // on all Bill of Supply / Tax Invoices, while locking GST rate/registration from the order-time snapshot.
  const snap = order.taxSnapshot
  const effectiveShop = snap
    ? {
        ...shop,
        gstRegistered: snap.gstRegistered,
        gstin: snap.gstin,
        gstRate: snap.gstRate,
        legalName: snap.legalName ?? shop.legalName,
        businessAddress: snap.businessAddress ?? shop.businessAddress,
        shopName: snap.shopName || shop.shopName,
        city: snap.city ?? shop.city,
        region: snap.region ?? shop.region,
        phone: snap.phone ?? shop.phone,
        email: snap.email ?? shop.email,
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
    <article data-invoice className={styles.invoiceArticle} aria-label={`${title} ${order.orderCode}`}>
      <header className={styles.invoiceHeader}>
        <div className={styles.headerLeftCol}>
          <h1 className={styles.invoiceTitle}>{title}</h1>
          <p className={styles.invoiceNoLine}>
            No. <span className={styles.monoStrong}>{order.orderCode}</span> · {formatDate(order.createdAt)}
          </p>
        </div>
        <div className={styles.headerSellerCol}>
          <p className={styles.sellerNameText}>{sellerName}</p>
          {sellerAddress && <p className={styles.sellerAddrText}>{sellerAddress}</p>}
          {effectiveShop.phone && <p className={styles.sellerMutedLine}>{effectiveShop.phone}</p>}
          {effectiveShop.email && <p className={styles.sellerMutedLine}>{effectiveShop.email}</p>}
          {taxed && effectiveShop.gstin && <p className={styles.gstinMono}>GSTIN: {effectiveShop.gstin}</p>}
        </div>
      </header>

      <section className={styles.billedToGrid} aria-label="Billed to">
        <div>
          <h2 className={styles.sectionKicker}>Billed to</h2>
          <p className={styles.billedBold}>{order.customerName}</p>
          <p className={styles.billedMuted}>{order.address}</p>
          <p className={styles.billedMuted}>{order.city} - {order.pincode}</p>
          <p className={styles.billedMuted}>{order.phone}</p>
        </div>
        <div className={styles.paymentRightCol}>
          <h2 className={styles.sectionKicker}>Payment</h2>
          <p className={styles.billedBold}>{payment.label}</p>
          {order.returnStage?.badge && order.returnStage.key !== "rejected" && (
            <p className={styles.billedSmallNote}>Return: {order.returnStage.customerLabel}</p>
          )}
          {order.paymentReference && <p className={styles.billedMonoRef}>Ref: {order.paymentReference}</p>}
        </div>
      </section>

      <div className={styles.tableScrollWrap}>
        <table className={styles.invoiceTable}>
          <caption className={styles.srOnly}>Items in this order</caption>
          <thead>
            <tr className={styles.theadRow}>
              <th scope="col" className={styles.thLeft}>Item</th>
              <th scope="col" className={styles.thMiddleRight}>Qty</th>
              <th scope="col" className={styles.thMiddleRight}>Rate</th>
              <th scope="col" className={styles.thRight}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.productId} className={styles.tbodyRow}>
                <td className={styles.tdLeft}>{i.name}</td>
                <td className={styles.tdMiddleNum}>{i.quantity}</td>
                <td className={styles.tdMiddleNum}>{formatMoney(i.price)}</td>
                <td className={styles.tdRightNum}>{formatMoney(i.price * i.quantity)}</td>
              </tr>
            ))}
            {order.discountAmount && order.discountAmount > 0 ? (
              <tr className={styles.tbodyPromoRow}>
                <td className={styles.tdLeftMedium} colSpan={3}>
                  Promo discount{order.promoCode ? ` (${order.promoCode})` : ""}
                </td>
                <td className={styles.tdRightBoldNum}>
                  -{formatMoney(order.discountAmount)}
                </td>
              </tr>
            ) : null}
            {order.extraFees.map((f, idx) => (
              <tr key={`${f.productId ?? "fee"}-${idx}`} className={styles.tbodyRow}>
                <td className={styles.tdLeft} colSpan={3}>
                  {f.label}
                  {f.productName ? ` (${f.productName})` : ""}
                </td>
                <td className={styles.tdRightNum}>{formatMoney(f.amount)}</td>
              </tr>
            ))}
            <tr className={styles.tbodyRow}>
              <td className={styles.tdLeft} colSpan={3}>Delivery</td>
              <td className={styles.tdRightNum}>{order.shippingFee > 0 ? formatMoney(order.shippingFee) : "Free"}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3} className={styles.tfootTh}>Total</th>
              <td className={styles.tfootTd}>{formatMoney(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {tax ? (
        <section className={styles.gstSection} aria-label="GST included">
          <p className={styles.gstRow}><span>Taxable value</span><span className={styles.tabularSpan}>{formatMoney(tax.taxable)}</span></p>
          <p className={styles.gstRowTop}>
            <span>GST @ {effectiveShop.gstRate}% (included in the total)</span>
            <span className={styles.tabularSpan}>{formatMoney(tax.gst)}</span>
          </p>
          <p className={styles.gstFootnote}>Prices are inclusive of GST. CGST + SGST or IGST applies depending on the delivery state.</p>
        </section>
      ) : (
        <p className={styles.nonGstNote}>
          {sellerName} is not registered under GST, so no tax is charged. This is a Bill of Supply, not a Tax Invoice.
        </p>
      )}

      <footer className={styles.invoiceFooter}>
        Thank you for shopping with {effectiveShop.shopName}. This is a computer-generated document.
      </footer>
    </article>
  )
}
