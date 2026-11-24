import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import styles from "./ui.module.css"

const buttonVariants = cva(
  styles.btnBase,
  {
    variants: {
      variant: {
        default: styles.btnVariantDefault,
        outline: styles.btnVariantOutline,
        secondary: styles.btnVariantSecondary,
        ghost: styles.btnVariantGhost,
        destructive: styles.btnVariantDestructive,
        link: styles.btnVariantLink,
      },
      size: {
        // Heights match the form fields: default = h-10 (fieldSize "md"), lg = h-11 (fieldSize "lg").
        default: styles.btnSizeDefault,
        xs: styles.btnSizeXs,
        sm: styles.btnSizeSm,
        lg: styles.btnSizeLg,
        icon: styles.btnSizeIcon,
        "icon-xs": styles.btnSizeIconXs,
        "icon-sm": styles.btnSizeIconSm,
        "icon-lg": styles.btnSizeIconLg,
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
