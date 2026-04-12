import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import { HtmlLang } from "@/components/shared/HtmlLang";
import { fontMono, fontSans } from "@/config/fonts";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${fontSans.variable} ${fontMono.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <HtmlLang locale={locale} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
