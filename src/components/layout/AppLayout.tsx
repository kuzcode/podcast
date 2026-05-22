import { Outlet } from 'react-router-dom'
import { BottomBar } from './BottomBar'
import { MiniPlayer } from '@/components/player/MiniPlayer'
import { FullPlayer } from '@/components/player/FullPlayer'
import { ToastContainer } from '@/components/ui/Toast'
import styles from './AppLayout.module.css'

export function AppLayout() {
  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <MiniPlayer />
      <BottomBar />
      <FullPlayer />
      <ToastContainer />
    </div>
  )
}
