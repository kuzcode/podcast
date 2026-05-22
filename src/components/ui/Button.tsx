import { motion } from 'framer-motion'
import clsx from 'clsx'
import type { ReactNode, ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gold'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  disabled,
  onClick,
  type = 'button',
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      className={clsx(styles.btn, styles[variant], styles[size], className)}
      disabled={disabled || loading}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
    >
      {loading ? <span className={styles.spinner} /> : icon}
      <span>{children}</span>
    </motion.button>
  )
}
