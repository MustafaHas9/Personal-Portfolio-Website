// Adapted from Cult UI's texture-button (https://www.cult-ui.com).
// Local changes: added a `gold` variant using the site accent, an `href` prop that
// renders a real <a>, and a <span> inner wrapper so it is valid HTML inside links.
import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariantsOuter = cva("glow-btn inline-flex no-underline", {
  variants: {
    variant: {
      primary:
        "w-full border border-[1px] dark:border-[2px] border-black/10 dark:border-black bg-gradient-to-b from-black/70 to-black dark:from-white dark:to-white/80 p-[1px] transition duration-300 ease-in-out ",
      gold:
        "w-full border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-primary/70 to-primary p-[1px] transition duration-300 ease-in-out [--glow-rest:rgb(217_119_6/0.4)] ",
      accent:
        "w-full border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-indigo-300/90 to-indigo-500 dark:from-indigo-200/70 dark:to-indigo-500 p-[1px] transition duration-300 ease-in-out ",
      destructive:
        "w-full border-[1px] dark:border-[2px] border-black/10 dark:border-neutral-950 bg-gradient-to-b from-red-300/90 to-red-500 dark:from-red-300/90 dark:to-red-500 p-[1px] transition duration-300 ease-in-out ",
      secondary:
        "w-full border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-neutral-950 dark:bg-neutral-600/50 p-[1px] transition duration-300 ease-in-out ",
      minimal:
        "group/texture-button w-full border-[1px] dark:border-[2px] border-black/20 bg-white/50 dark:border-neutral-950 dark:bg-neutral-600/80 p-[1px] active:bg-neutral-200 dark:active:bg-neutral-800 hover:bg-gradient-to-t hover:from-neutral-100 to-white dark:hover:from-neutral-600/50 dark:hover:to-neutral-600/70",
      icon: "group/texture-button rounded-full border dark:border-neutral-950 border-black/10 dark:bg-neutral-600/50 bg-white/50 p-[1px] active:bg-neutral-200 dark:active:bg-neutral-800 hover:bg-gradient-to-t hover:from-neutral-100 to-white dark:hover:from-neutral-700 dark:hover:to-neutral-600",
    },
    size: {
      sm: "rounded-[6px]",
      default: "rounded-[12px]",
      lg: "rounded-[14px]",
      icon: "rounded-full",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "default",
  },
})

const innerVariants = cva(
  "w-full h-full flex items-center justify-center font-semibold text-foreground",
  {
    variants: {
      variant: {
        primary:
          "gap-2 bg-gradient-to-b from-neutral-800 to-black  dark:from-neutral-200 dark:to-neutral-50 text-sm text-white/90 dark:text-black/80 transition duration-300 ease-in-out  hover:from-stone-800 hover:to-neutral-800/70 dark:hover:from-stone-200 dark:hover:to-neutral-200 dark:active:from-stone-300 dark:active:to-neutral-300 active:bg-gradient-to-b active:from-black active:to-black ",
        gold:
          "gap-2 bg-gradient-to-b from-primary/85 to-primary text-sm text-white transition duration-300 ease-in-out hover:from-primary/75 hover:to-primary/90 active:from-primary active:to-primary/90",
        accent:
          "gap-2 bg-gradient-to-b from-indigo-400 to-indigo-600 text-sm text-white/90 transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-indigo-400/70 hover:to-indigo-600/70 dark:hover:from-indigo-400/70 dark:hover:to-indigo-600/70 active:bg-gradient-to-b active:from-indigo-400/80 active:to-indigo-600/80 dark:active:from-indigo-400 dark:active:to-indigo-600",
        destructive:
          "gap-2 bg-gradient-to-b from-red-400/60 to-red-500/60 text-sm text-white/90 transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-red-400/70 hover:to-red-600/70 dark:hover:from-red-400/70 dark:hover:to-red-500/80 active:bg-gradient-to-b active:from-red-400/80 active:to-red-600/80 dark:active:from-red-400 dark:active:to-red-500",
        secondary:
          "gap-2 bg-gradient-to-b from-neutral-100/80 to-neutral-200/50 dark:from-neutral-800 dark:to-neutral-700/50 text-sm transition duration-300 ease-in-out hover:bg-gradient-to-b hover:from-neutral-200/40 hover:to-neutral-300/60 dark:hover:from-neutral-700 dark:hover:to-neutral-700/60 active:bg-gradient-to-b active:from-neutral-200/60 active:to-neutral-300/70 dark:active:from-neutral-800 dark:active:to-neutral-700",
        minimal:
          "gap-2 bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-800 dark:to-neutral-700/50 text-sm transition duration-300 ease-in-out group-hover/texture-button:bg-gradient-to-b group-hover/texture-button:from-neutral-50/50 group-hover/texture-button:to-neutral-100/60 dark:group-hover/texture-button:from-neutral-700 dark:group-hover/texture-button:to-neutral-700/60 group-active/texture-button:bg-gradient-to-b group-active/texture-button:from-neutral-100/60 group-active/texture-button:to-neutral-100/90 dark:group-active/texture-button:from-neutral-800 dark:group-active/texture-button:to-neutral-700",
        icon: "bg-gradient-to-b from-white to-neutral-50/50 dark:from-neutral-800 dark:to-neutral-700/50 group-active/texture-button:bg-neutral-200 dark:group-active/texture-button:bg-neutral-800 rounded-full",
      },
      size: {
        sm: "text-xs rounded-[4px] px-4 py-1",
        default: "text-sm rounded-[10px] px-4 py-2",
        lg: "text-base rounded-[12px] px-7 py-3",
        icon: " rounded-full p-2",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

type Variant = "primary" | "gold" | "secondary" | "accent" | "destructive" | "minimal" | "icon"
type Size = "default" | "sm" | "lg" | "icon"

interface BaseProps {
  variant?: Variant
  size?: Size
  className?: string
  children?: React.ReactNode
}

type ButtonProps = BaseProps &
  Omit<React.ComponentProps<"button">, keyof BaseProps> & { href?: undefined }

type LinkProps = BaseProps &
  Omit<React.ComponentProps<"a">, keyof BaseProps> & { href: string }

export type TextureButtonProps = ButtonProps | LinkProps

function TextureButton({
  variant = "primary",
  size = "default",
  className,
  children,
  ...rest
}: TextureButtonProps) {
  const outerClass = cn(buttonVariantsOuter({ variant, size }), className)
  const inner = <span className={cn(innerVariants({ variant, size }))}>{children}</span>

  if (rest.href !== undefined) {
    return (
      <a className={outerClass} {...(rest as React.ComponentProps<"a">)}>
        {inner}
      </a>
    )
  }

  return (
    <button className={outerClass} {...(rest as React.ComponentProps<"button">)}>
      {inner}
    </button>
  )
}

export { TextureButton }
