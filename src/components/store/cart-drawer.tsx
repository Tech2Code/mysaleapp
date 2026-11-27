"use client"

import { ArrowRightIcon, ShoppingBagIcon, SparklesIcon, Trash2Icon, TruckIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { cartCount, cartLineKey, cartSubtotal, MAX_QTY_PER_ITEM, useCart, type CartItem } from "@/store/cart"
import styles from "./cart.module.css"
import { useLiveCart, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { QuantityStepper } from "./quantity-stepper"
import { useStoreSettings } from "./store-settings-provider"

/** "Add ₹X more for free delivery" with a progress bar. Used in the drawer, the cart page and checkout. */
export function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const threshold = useStoreSettings().freeDeliveryAbove
  if (!threshold) return null
  const remaining = Math.max(0, Math.round((threshold - subtotal + Number.EPSILON) * 100) / 100)
  const pct = Math.min(100, (subtotal / threshold) * 100)
  const unlocked = remaining === 0

  return (
    <div

      className={cn(styles.shippingBanner, unlocked && styles.shippingBannerUnlocked)}
    >
      <div className={styles.bannerTopRow}>
        <p className={styles.bannerMessage}>
          {unlocked ? (
            <SparklesIcon className={styles.unlockedIcon} />
          ) : (
            <TruckIcon className={styles.truckIcon} />
          )}
          {unlocked ? (
            <span>You unlocked <strong>Free Delivery</strong></span>
          ) : (
            <span>
              Add <strong className={styles.highlightStrong}>{formatPrice(remaining)}</strong> more for <strong className={styles.accentStrong}>Free Delivery</strong>
            </span>
          )}
        </p>
        <span className={styles.percentBadge}>
          {unlocked ? 100 : Math.min(99, Math.floor(pct))}%
        </span>
      </div>
      <div className={styles.progressTrack}>
        <m.div

          className={cn(styles.progressFill, unlocked && styles.progressFillUnlocked)}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  )
}

function DrawerItem({
  item,
  available = true,
  highlighted,
  onNavigate,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  available?: boolean
  highlighted: boolean
  onNavigate: () => void
  onQuantity: (q: number) => void
  onRemove: () => void
}) {
  return (
    <m.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(styles.drawerItemCard, highlighted && styles.drawerItemHighlighted, !available && styles.drawerItemUnavailable)}
    >
      {highlighted && (
        <m.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={styles.justAddedBadge}
        >
          Just added
        </m.span>
      )}

      <Link
        href={`/products/${item.slug}`}
        onClick={onNavigate}
        className={styles.itemThumbLink}
      >
        <ProductImage src={item.image} alt={item.name} sizes="96px" className={styles.itemThumbImg} />
      </Link>

      <div className={styles.itemInfoCol}>
        <div className={styles.itemTopRow}>
          <Link href={`/products/${item.slug}`} onClick={onNavigate} className={styles.itemNameLink}>
            {item.name}
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className={styles.removeItemBtn}
            aria-label={`Remove ${item.name}`}
          >
            <Trash2Icon className={styles.trashIcon} />
          </button>
        </div>
        {item.variantLabel && <span className={styles.variantPill}>{item.variantLabel}</span>}
        <p className={styles.unitPriceText}>{available ? `${formatPrice(item.price)} each` : "Unavailable"}</p>

        {available && (
          <div className={styles.itemBottomRow}>
            <QuantityStepper
              label={item.name}
              value={item.quantity}
              max={Math.min(item.maxQuantity, MAX_QTY_PER_ITEM)}
              onChange={onQuantity}
            />
            <span className={styles.lineTotalText}>{formatPrice(item.price * item.quantity)}</span>
          </div>
        )}
      </div>
    </m.li>
  )
}

/**
 * The slide-in cart. A side panel on larger screens, a bottom sheet on phones.
 * It opens whenever something is added and highlights that item.
 */
export function CartDrawer({ products }: { products?: LiveProduct[] }) {
  const items = useCart((s) => s.items)
  const isOpen = useCart((s) => s.isOpen)
  const lastAddedId = useCart((s) => s.lastAddedId)
  const setOpen = useCart((s) => s.setOpen)
  const setQuantity = useCart((s) => s.setQuantity)
  const remove = useCart((s) => s.remove)
  const isPhone = useMediaQuery("(max-width: 639px)")
  const hasLiveCatalogue = Boolean(products && products.length > 0)
  const live = useLiveCart(products ?? [])
  const displayLines = hasLiveCatalogue ? live.lines : items.map((item) => ({ ...item, available: true }))
  const subtotal = hasLiveCatalogue ? live.subtotal : cartSubtotal(items)
  const count = hasLiveCatalogue ? live.count : cartCount(items)
  const hasUnavailable = hasLiveCatalogue ? live.hasUnavailable : false
  const checkoutBlocked = hasUnavailable || (hasLiveCatalogue && count === 0)
  const close = () => setOpen(false)

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent
        side={isPhone ? "bottom" : "right"}
        className={cn(styles.drawerSheet, isPhone ? styles.drawerSheetPhone : styles.drawerSheetDesktop)}
      >
        {isPhone && <span aria-hidden className={styles.dragHandle} />}

        <SheetHeader className={styles.drawerHeader}>
          <span className={styles.headerIconBox}>
            <ShoppingBagIcon className={styles.bagIcon} aria-hidden />
          </span>
          <div className={styles.headerTitleGroup}>
            <SheetTitle className={styles.sheetTitleText}>Your cart</SheetTitle>
            <p className={styles.sheetSubtitleText}>
              {items.length === 0 ? "Nothing here yet" : `${count} item${count === 1 ? "" : "s"} · ${hasUnavailable ? "review unavailable items" : "ready to checkout"}`}
            </p>
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className={styles.drawerEmptyState}>
            <div className={styles.emptyCircle}>
              <ShoppingBagIcon className={styles.emptyBagIcon} />
            </div>
            <p className={styles.emptyTitle}>Your cart is empty</p>
            <p className={styles.emptyHint}>Find something you&apos;ll love.</p>
            <Link href="/products" onClick={close} className={cn(buttonVariants({ size: "lg" }), styles.startShoppingBtn)}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.drawerScrollBody}>
              <FreeShippingBar subtotal={subtotal} />
              {hasUnavailable && (
                <p className={styles.drawerUnavailableAlert}>
                  Some items are sold out or no longer available. Remove them to checkout.
                </p>
              )}
              <ul className={styles.drawerItemList}>
                <AnimatePresence initial={false} mode="popLayout">
                  {displayLines.map((item) => {
                    const lineKey = cartLineKey(item)
                    return (
                      <DrawerItem
                        key={lineKey}
                        item={item}
                        available={item.available}
                        highlighted={lineKey === lastAddedId}
                        onNavigate={close}
                        onQuantity={(q) => setQuantity(lineKey, q)}
                        onRemove={() => remove(lineKey)}
                      />
                    )
                  })}
                </AnimatePresence>
              </ul>
            </div>

            <div className={styles.drawerFooter}>
              <div className={styles.subtotalRow}>
                <span className={styles.subtotalLabel}>Subtotal</span>
                <span className={styles.subtotalValue}>{formatPrice(subtotal)}</span>
              </div>
              <p className={styles.deliveryHint}>Delivery and any product charges are added at checkout.</p>
              <Link
                href="/checkout"
                aria-disabled={checkoutBlocked}
                tabIndex={checkoutBlocked ? -1 : undefined}
                onClick={(e) => {
                  if (checkoutBlocked) {
                    e.preventDefault()
                    return
                  }
                  close()
                }}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  styles.checkoutBtn,
                  checkoutBlocked && styles.checkoutBtnDisabled
                )}
              >
                Checkout <ArrowRightIcon className={styles.checkoutArrow} />
              </Link>
              <Link
                href="/cart"
                onClick={close}
                className={styles.viewFullCartLink}
              >
                View full cart
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
