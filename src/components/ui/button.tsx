import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import styles from "./ui.module.css"

const buttonVariants = cva(
  styles.btnBase,
  {
    variants: {
      variant: {
        default: styles.btnPrimary,
        primary: styles.btnPrimary,
        outline: styles.btnOutline,
        secondary: styles.btnSecondary,
        ghost: styles.btnGhost,
        soft: styles.btnSoft,
        destructive: styles.btnDestructive,
        destructiveOutline: styles.btnDestructiveOutline,
        success: styles.btnSuccess,
        whatsapp: styles.btnWhatsapp,
        link: styles.btnLink,
      },
      size: {
        // Default adapts per UI: 44px in Storefront, 40px in Admin (matching form fields).
        default: styles.btnSizeDefault,
        xs: styles.btnSizeXs,
        sm: styles.btnSizeSm,
        md: styles.btnSizeMd,
        lg: styles.btnSizeLg,
        xl: styles.btnSizeXl,
        icon: styles.btnSizeIcon,
        "icon-xs": styles.btnSizeIconXs,
        "icon-sm": styles.btnSizeIconSm,
        "icon-lg": styles.btnSizeIconLg,
      },
      fullWidth: {
        true: styles.btnFull,
        false: "",
      },
      shape: {
        default: "",
        pill: styles.btnPill,
        circle: styles.btnCircle,
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
      shape: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  fullWidth,
  shape,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, fullWidth, shape, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
