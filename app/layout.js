// app/layout.js
import './globals.css'

export const viewport = {
  themeColor: '#D4266A',
}

export const metadata = {
  title: 'churpie. — everyone who loves them, in one minute',
  description: 'Create a group video card in minutes. Everyone records 15 seconds — you send one powerful message.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'churpie.' },
  openGraph: {
    title: 'churpie. — everyone who loves them, in one minute',
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
        <link
          href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Permanent+Marker&family=Caveat:wght@400;600;700&family=DM+Serif+Display&family=DM+Sans:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body style={{ margin: 0, background: '#F5F0E8', fontFamily: "'Courier Prime', 'Courier New', monospace" }}>
        {children}
      </body>
    </html>
  )
}
