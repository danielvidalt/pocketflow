'use client'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTheme } from './ThemeProvider'

export default function SplashScreen() {
  const { theme } = useTheme()
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!sessionStorage.getItem('pf_splash_done')) {
      setVisible(true)
    }
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem('pf_splash_done', '1')
    }, 400)
  }

  if (!visible) return null

  return (
    <div
      onClick={dismiss}
      className={leaving ? 'splash-out' : ''}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        cursor: 'pointer',
        maxWidth: 430,
        left: '50%',
        transform: 'translateX(-50%)',
      }}
    >
      <Image
        src={theme === 'light' ? '/splash-light.png' : '/splash-dark.png'}
        alt="PocketFlow"
        fill
        style={{ objectFit: 'cover', objectPosition: 'center top' }}
        priority
      />
    </div>
  )
}
