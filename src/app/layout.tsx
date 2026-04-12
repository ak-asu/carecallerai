import "./globals.css";

// html/body live in [locale]/layout.tsx so lang attr can reflect locale
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
