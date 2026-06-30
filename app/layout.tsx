import type { Metadata } from 'next'
import { Inter, Space_Grotesk } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'
import 'katex/dist/katex.min.css'
import { ThemeProvider } from '@/components/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

const spaceGrotesk = Space_Grotesk({
  variable: '--font-brand',
  subsets: ['latin'],
  weight: ['600', '700'],
})

export const metadata: Metadata = {
  title: 'Azzura',
  description: 'Azzura AI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster position="top-center" duration={2500} visibleToasts={1} />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
