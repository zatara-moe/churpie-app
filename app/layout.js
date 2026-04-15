// app/layout.js
import './globals.css'

export const viewport = {
  themeColor: '#C23B6B',
}

export const metadata = {
  title: 'churpie. — send love, together',
  description: 'Create a group video card in minutes. Everyone records 15 seconds — you send one powerful message.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'churpie.' },
  openGraph: {
    title: 'churpie. — send love, together',
    description: 'Create a group video card in minutes.',
    url: 'https://churpie.me',
    siteName: 'churpie.',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ margin: 0, background: '#f0ebe6', fontFamily: "'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
