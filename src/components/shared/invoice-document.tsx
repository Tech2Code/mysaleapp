import { splitCityState } from "@/features/location/states"
import type { Order } from "@/features/orders/types"
import { paymentDisplay } from "@/features/orders/types"
import { gstActive, gstIncluded, invoiceTitle } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatDate, formatMoney } from "@/lib/format"
import styles from "./shared.module.css"

const round2 = (n: number) => Math.round((n + (n >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100

/**
 * Printable bill for one order. Shows a clear audit-trail summary:
 * Subtotal -> Less: Promo Discount -> Add: Extra Fees & Delivery -> (Taxable Value + CGST/SGST or IGST) -> Grand Total.
 * Shop not registered → "Bill of Supply" (no tax). Registered → "Tax Invoice" with GSTIN and GST split.
 * Colours follow the theme on screen; globals.css prints it black on white.
 */
export function InvoiceDocument({ order, shop }: { order: Order; shop: StoreSettings }) {
  // Use the order-time taxSnapshot for immutable Tax Invoice seller/GST details, falling back to live Store Settings for legacy orders.
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
  const itemsSubtotal = round2(order.items.reduce((sum, i) => sum + i.price * i.quantity, 0))
  const discount = order.discountAmount && order.discountAmount > 0 ? order.discountAmount : 0
  const sellerState = effectiveShop.region?.trim().toLowerCase() ?? ""
  const customerState = splitCityState(order.city).state?.trim().toLowerCase() ?? ""
  const isIntraState = Boolean(sellerState && customerState && sellerState === customerState)
  const cgst = tax ? round2(tax.gst / 2) : 0
  const sgst = tax ? round2(tax.gst - cgst) : 0
  const halfRate = round2(effectiveShop.gstRate / 2)
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
          {payment.detail && <p className={styles.billedSmallNote}>{payment.detail} refunded</p>}
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
              <tr key={i.variantId ? `${i.productId}::${i.variantId}` : i.productId} className={styles.tbodyRow}>
                <td className={styles.tdLeft}>
                  <span>{i.name}</span>
                  {i.variantLabel && <span className={styles.invoiceVariantNote}> ({i.variantLabel})</span>}
                </td>
                <td className={styles.tdMiddleNum}>{i.quantity}</td>
                <td className={styles.tdMiddleNum}>{formatMoney(i.price)}</td>
                <td className={styles.tdRightNum}>{formatMoney(i.price * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className={styles.invoiceSummaryWrap} aria-label="Invoice summary">
        <dl className={styles.invoiceSummaryBox}>
          <div className={styles.summaryRow}>
            <dt className={styles.summaryLabel}>Subtotal</dt>
            <dd className={styles.summaryValue}>{formatMoney(itemsSubtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className={styles.summaryRowPromo}>
              <dt className={styles.summaryLabel}>
                Less: Promo discount{order.promoCode ? ` (${order.promoCode})` : ""}
              </dt>
              <dd className={styles.summaryValueBold}>-{formatMoney(discount)}</dd>
            </div>
          )}
          {order.extraFees.map((f, idx) => (
            <div key={`${f.productId ?? "fee"}-${idx}`} className={styles.summaryRow}>
              <dt className={styles.summaryLabel}>
                Add: {f.label}
                {f.productName ? ` (${f.productName})` : ""}
              </dt>
              <dd className={styles.summaryValue}>+{formatMoney(f.amount)}</dd>
            </div>
          ))}
          <div className={styles.summaryRow}>
            <dt className={styles.summaryLabel}>Add: Delivery</dt>
            <dd className={styles.summaryValue}>
              {order.shippingFee > 0 ? `+${formatMoney(order.shippingFee)}` : "Free"}
            </dd>
          </div>

          {tax && (
            <div className={styles.summaryTaxBlock}>
              <div className={styles.summaryRowMuted}>
                <dt className={styles.summaryLabel}>Taxable value (excl. GST)</dt>
                <dd className={styles.summaryValue}>{formatMoney(tax.taxable)}</dd>
              </div>
              {isIntraState ? (
                <>
                  <div className={styles.summaryRowMuted}>
                    <dt className={styles.summaryLabel}>Add: CGST @ {halfRate}%</dt>
                    <dd className={styles.summaryValue}>+{formatMoney(cgst)}</dd>
                  </div>
                  <div className={styles.summaryRowMuted}>
                    <dt className={styles.summaryLabel}>Add: SGST @ {halfRate}%</dt>
                    <dd className={styles.summaryValue}>+{formatMoney(sgst)}</dd>
                  </div>
                </>
              ) : (
                <div className={styles.summaryRowMuted}>
                  <dt className={styles.summaryLabel}>Add: IGST @ {effectiveShop.gstRate}%</dt>
                  <dd className={styles.summaryValue}>+{formatMoney(tax.gst)}</dd>
                </div>
              )}
            </div>
          )}

          <div className={styles.summaryGrandTotalRow}>
            <dt className={styles.summaryGrandTotalLabel}>Grand Total</dt>
            <dd className={styles.summaryGrandTotalValue}>{formatMoney(order.total)}</dd>
          </div>
        </dl>
      </section>

      {tax ? (
        <p className={styles.nonGstNote}>
          Prices are inclusive of GST @ {effectiveShop.gstRate}%. Net Taxable Value ({formatMoney(tax.taxable)}) + GST ({formatMoney(tax.gst)}) = Grand Total ({formatMoney(order.total)}). Tax is not payable under Reverse Charge.
        </p>
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
