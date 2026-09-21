import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon Prof — Professeur particulier IA",
  description: "Un professeur particulier qui explique, questionne, corrige et ne valide une notion que lorsqu'elle est démontrée.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎓</text></svg>" },
};

export default function MonProfLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
