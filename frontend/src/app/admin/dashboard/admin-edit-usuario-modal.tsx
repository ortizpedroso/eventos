"use client";

import { useEffect, useState } from "react";

import { TelefoneInput } from "@/components/telefone-input";
import { adminFetch } from "@/lib/admin-api";

export type UsuarioAdminEdit = {
  id: string;
  email: string;
  nome: string;
  telefone: string | null;
  tipo: string;
  ativo?: boolean;
  is_platform_admin?: boolean;
};

type Props = {
  usuario: UsuarioAdminEdit | null;
  onClose: () => void;
  onSaved: () => void;
};

export function AdminEditUsuarioModal({ usuario, onClose, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!usuario) return;
    setNome(usuario.nome);
    setEmail(usuario.email);
    setTelefone(usuario.telefone?.replace(/\D/g, "") ?? "");
    setErro(null);
  }, [usuario]);

  if (!usuario) return null;

  async function salvar() {
    setBusy(true);
    setErro(null);
    try {
      await adminFetch(`/api/admin/usuarios/${usuario!.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim() || null,
        }),
      });
      onSaved();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar usuário");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg">
        <h3 className="text-lg font-semibold text-zinc-900">Editar usuário</h3>
        <p className="mt-1 text-xs text-zinc-500 capitalize">{usuario.tipo}</p>
        <div className="mt-4 space-y-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">Nome</span>
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={200} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">E-mail</span>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">Telefone</span>
            <TelefoneInput value={telefone} onChange={setTelefone} />
          </label>
        </div>
        {erro ? (
          <p className="mt-3 text-sm text-red-700" role="alert">{erro}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-success px-4 py-2 text-sm" disabled={busy} onClick={() => void salvar()}>
            {busy ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" className="btn-outline px-4 py-2 text-sm" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
