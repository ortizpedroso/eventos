import type { Metadata } from "next";
import Link from "next/link";
import { AjudaNav } from "@/components/ajuda-nav";

export const metadata: Metadata = {
  title: "Central de ajuda | EventosBR",
};

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-3xl py-12 px-4">
      <h1 className="text-3xl font-bold text-zinc-900">Central de ajuda</h1>
      <AjudaNav current="/ajuda" />
      <ul className="space-y-4 text-sm">
        <li><Link href="/ajuda/como-comprar" className="text-emerald-800 hover:underline">Como comprar ingressos</Link></li>
        <li><Link href="/ajuda/como-criar-evento" className="text-emerald-800 hover:underline">Como criar um evento</Link></li>
        <li><Link href="/ajuda/reembolsos" className="text-emerald-800 hover:underline">Reembolsos e cancelamentos</Link></li>
        <li><Link href="/ajuda/parcelamento-e-taxas" className="text-emerald-800 hover:underline">Parcelamento e taxas</Link></li>
      </ul>
    </div>
  );
}
