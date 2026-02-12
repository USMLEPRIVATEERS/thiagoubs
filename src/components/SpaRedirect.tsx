'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SpaRedirect() {
  const router = useRouter()

  useEffect(() => {
    const redirectPath = sessionStorage.getItem('spa-redirect')
    if (redirectPath) {
      sessionStorage.removeItem('spa-redirect')
      // Strip basePath prefix before navigating
      const basePath = '/thiagoubs'
      const path = redirectPath.startsWith(basePath)
        ? redirectPath.slice(basePath.length) || '/'
        : redirectPath
      router.replace(path)
    }
  }, [router])

  return null
}
