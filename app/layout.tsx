import type { Metadata } from "next";
import LiveChatWidget from "@/components/layout/LiveChatWidget";

import "../public/assets/css/bootstrap.min.css";
import "../public/assets/css/style.css";
import "../public/assets/css/responsive.css";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/autoplay";
import 'swiper/css/effect-fade'

export const metadata: Metadata = {
  title: "Lucid Global Invest | Trusted Investment & Online Trading Platform",
  description:
    "Lucid Global Invest is a modern online investment and trading platform offering secure trading solutions, market insights, financial growth opportunities, and professional investment services.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}

        <LiveChatWidget />
      </body>
    </html>
  );
}
