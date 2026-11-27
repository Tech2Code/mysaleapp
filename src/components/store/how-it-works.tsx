import { BadgeIndianRupeeIcon, HeartHandshakeIcon, ShoppingBagIcon, TruckIcon } from "lucide-react"
import { FadeIn } from "@/components/shared/motion"
import styles from "./how-it-works.module.css"

const steps = [
  { icon: ShoppingBagIcon, title: "Pick what you love", text: "Add what you love to your cart — no account needed." },
  { icon: BadgeIndianRupeeIcon, title: "Pay by UPI", text: "Pay securely with any UPI app and share the reference number." },
  { icon: HeartHandshakeIcon, title: "We confirm & pack", text: "Once your payment is verified, we confirm and pack your order carefully." },
  { icon: TruckIcon, title: "Delivered with care", text: "Track every step online with your order code." },
]

export function HowItWorks() {
  return (
    <section className={styles.howSection} aria-labelledby="how-title">
      <FadeIn className={styles.headerBlock}>
        <p className={styles.eyebrowText}>Simple ordering</p>
        <h2 id="how-title" className={styles.sectionTitle}>
          From our store to your doorstep in 4 easy steps
        </h2>
      </FadeIn>
      <ol className={styles.stepsGrid}>
        {steps.map((s, i) => (
          <li key={s.title} className={styles.stepItem}>
            <FadeIn delay={i * 0.06} className={styles.stepCard}>
              <div className={styles.stepTopRow}>
                <div className={styles.iconBox}>
                  <s.icon className={styles.stepIcon} aria-hidden />
                </div>
                <span className={styles.stepNumber}>
                  0{i + 1}
                </span>
              </div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDescription}>{s.text}</p>
            </FadeIn>
          </li>
        ))}
      </ol>
    </section>
  )
}
