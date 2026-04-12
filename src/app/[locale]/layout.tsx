import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { HeroUIProvider } from '@heroui/react'

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <HeroUIProvider>
            {children}
          </HeroUIProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
