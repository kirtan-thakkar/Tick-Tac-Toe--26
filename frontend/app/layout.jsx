import { Outfit, Geist } from 'next/font/google';
import { DM_Sans } from 'next/font/google';
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const dm_sans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

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
      className={cn("h-full", "antialiased", dm_sans.className, outfit.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
