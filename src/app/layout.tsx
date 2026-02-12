import type { Metadata } from 'next'
import './globals.css'
import SpaRedirect from '@/components/SpaRedirect'

export const metadata: Metadata = {
  title: 'UBS Sitio dos Remedios - Indicadores de Saude',
  description: 'Sistema de Gestao de Indicadores de Saude',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-gray-50 antialiased">
        <SpaRedirect />
        {children}
      </body>
    </html>
  )
}
