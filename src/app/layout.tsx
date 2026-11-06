import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ConvertTrio — Private Image Converter",
    template: "%s | ConvertTrio",
  },
  description:
    "Convert PNG, JPG, WebP, BMP and AVIF images privately in your browser. No account, no server upload.",
  applicationName: "ConvertTrio",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "ConvertTrio — Private Image Converter",
    description: "Simple, private, browser-based image conversion.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
