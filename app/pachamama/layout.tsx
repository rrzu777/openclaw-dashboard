import type { Metadata } from "next";
import '@xterm/xterm/css/xterm.css';

export const metadata: Metadata = {
  title: "Pachamama",
  description: "Terminal",
};

export default function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
