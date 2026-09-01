import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

// docs/design-system.md: Outfit via next/font/google, never a <link> tag —
// that would send a browser request to Google's servers (DSGVO, see PROJ-4).
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Pokémon Quiz",
  description: "Pokémon am Bild erkennen und den deutschen Namen treffen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={outfit.variable}>
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
