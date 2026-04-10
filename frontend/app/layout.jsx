import { Outfit } from 'next/font/google';

import "./globals.css";

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'], 
  display: 'swap',
  variable: '--font-outfit',
});


export const metadata = {
  title: "SentinelIQ",
  description: "A great application",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${outfit.className} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
