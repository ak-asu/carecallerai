import {
  IBM_Plex_Mono as FontMono,
  Manrope as FontSans,
} from "next/font/google";

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
});
