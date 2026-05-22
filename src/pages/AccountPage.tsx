import { motion } from 'framer-motion'
import {
  User,
  Gauge,
  Moon,
  SkipForward,
  Bell,
  Shield,
  LogOut,
  ExternalLink,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePlayerStore } from '@/store/playerStore'
import { PLAYBACK_SPEEDS, SLEEP_TIMER_OPTIONS } from '@/lib/constants'
import { getTelegramWebApp, isInTelegram } from '@/lib/telegram'
import styles from './AccountPage.module.css'

export function AccountPage() {
  const user = useAuthStore((s) => s.user)
  const updateSettings = useAuthStore((s) => s.updateSettings)
  const logout = useAuthStore((s) => s.logout)
  const setRate = usePlayerStore((s) => s.setRate)
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer)

  if (!user) return null

  const settings = user.settings

  const update = (partial: Partial<typeof settings>) => {
    updateSettings(partial)
    if (partial.playbackSpeed) setRate(partial.playbackSpeed)
    if (partial.sleepTimerMinutes !== undefined)
      setSleepTimer(partial.sleepTimerMinutes)
  }

  return (
    <div className="page">
      <motion.div
        className={styles.profile}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className={styles.avatar}>
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="" />
          ) : (
            <User size={40} />
          )}
        </div>
        <div>
          <h1 className={styles.name}>
            {user.firstName} {user.lastName || ''}
          </h1>
          {user.username && <p className={styles.username}>@{user.username}</p>}
          {user.isPremium && <span className={styles.premium}>Telegram Premium</span>}
        </div>
      </motion.div>

      <section className={styles.section}>
        <h2 className="section-title">Воспроизведение</h2>

        <div className={styles.setting}>
          <div className={styles.settingLabel}>
            <Gauge size={18} />
            <span>Скорость по умолчанию</span>
          </div>
          <div className={styles.optionRow}>
            {PLAYBACK_SPEEDS.filter((s) => [0.75, 1, 1.25, 1.5, 2].includes(s)).map((s) => (
              <button
                key={s}
                className={settings.playbackSpeed === s ? styles.optionActive : ''}
                onClick={() => update({ playbackSpeed: s })}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className={styles.setting}>
          <div className={styles.settingLabel}>
            <SkipForward size={18} />
            <span>Перемотка вперёд</span>
          </div>
          <div className={styles.optionRow}>
            {[10, 15, 30, 45].map((s) => (
              <button
                key={s}
                className={settings.skipForwardSec === s ? styles.optionActive : ''}
                onClick={() => update({ skipForwardSec: s })}
              >
                {s}с
              </button>
            ))}
          </div>
        </div>

        <div className={styles.setting}>
          <div className={styles.settingLabel}>
            <SkipForward size={18} style={{ transform: 'scaleX(-1)' }} />
            <span>Перемотка назад</span>
          </div>
          <div className={styles.optionRow}>
            {[5, 10, 15, 30].map((s) => (
              <button
                key={s}
                className={settings.skipBackwardSec === s ? styles.optionActive : ''}
                onClick={() => update({ skipBackwardSec: s })}
              >
                {s}с
              </button>
            ))}
          </div>
        </div>

        <div className={styles.setting}>
          <div className={styles.settingLabel}>
            <Moon size={18} />
            <span>Таймер сна по умолчанию</span>
          </div>
          <div className={styles.optionRow}>
            {SLEEP_TIMER_OPTIONS.filter((m) => m <= 30 || m === 0).map((m) => (
              <button
                key={m}
                className={settings.sleepTimerMinutes === m ? styles.optionActive : ''}
                onClick={() => update({ sleepTimerMinutes: m })}
              >
                {m === 0 ? 'Выкл' : `${m}м`}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.toggle}>
          <span>Автовоспроизведение следующего</span>
          <input
            type="checkbox"
            checked={settings.autoPlayNext}
            onChange={(e) => update({ autoPlayNext: e.target.checked })}
          />
        </label>
      </section>

      <section className={styles.section}>
        <h2 className="section-title">Приложение</h2>

        <button className={styles.menuItem}>
          <Bell size={18} />
          <span>Уведомления о новых эпизодах</span>
          <span className={styles.comingSoon}>скоро</span>
        </button>

        <button className={styles.menuItem}>
          <Shield size={18} />
          <span>Конфиденциальность</span>
        </button>

        {isInTelegram() && (
          <button
            className={styles.menuItem}
            onClick={() => getTelegramWebApp()?.openLink('https://t.me')}
          >
            <ExternalLink size={18} />
            <span>Открыть в Telegram</span>
          </button>
        )}
      </section>

      <div className={styles.footer}>
        <p>Atelier v1.0</p>
        <p className={styles.footerSub}>Подкасты в стиле Возрождения</p>
        <button className={styles.logout} onClick={logout}>
          <LogOut size={16} />
          Выйти
        </button>
      </div>
    </div>
  )
}
