import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | EventosBR",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh] bg-zinc-50/50">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-950">
        Painel interno EventosBR — uso restrito ao operador da plataforma
      </div>
      {children}
    </div>
  );
}
