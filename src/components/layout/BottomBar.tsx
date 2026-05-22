import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Search, Heart, User } from 'lucide-react'
import { haptic } from '@/lib/telegram'
import styles from './BottomBar.module.css'

const tabs = [
  { to: '/', icon: Home, label: 'Главная' },
  { to: '/search', icon: Search, label: 'Поиск' },
  { to: '/likes', icon: Heart, label: 'Лайки' },
  { to: '/account', icon: User, label: 'Аккаунт' },
]

export function BottomBar() {
  return (
    <nav className={styles.bar}>
      {tabs.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.active : ''}`
          }
          onClick={() => haptic('selection')}
        >
          {({ isActive }) => (
            <>
              <div className={styles.iconWrap}>
                {isActive && (
                  <motion.div
                    className={styles.indicator}
                    layoutId="bottom-indicator"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              </div>
              <span className={styles.label}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
