import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "The Answer Book · AI Tutor",
  description:
    "Open-source Socratic AI tutor for international-school students — chat, homework photos, voice, and step-by-step coaching. https://github.com/zilinli/ryan_learning",
  appleWebApp: {
    capable: true,
    title: "The Answer Book",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3ebe0" },
    { media: "(prefers-color-scheme: dark)", color: "#1a120c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("spark.theme")||"light";var d=localStorage.getItem("spark.dark");if(!t||t==="light"){if(d==="true")t="dark";else if(d===null&&window.matchMedia("(prefers-color-scheme:dark)").matches)t="dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
