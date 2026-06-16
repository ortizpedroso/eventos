"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { feedbackCheckinSucesso } from "@/lib/checkin-feedback";

type Html5QrcodeModule = typeof import("html5-qrcode");
type Html5QrcodeInstance = InstanceType<Html5QrcodeModule["Html5Qrcode"]>;

let html5QrcodeModule: Html5QrcodeModule | null = null;

async function importHtml5Qrcode(): Promise<Html5QrcodeModule> {
  if (!html5QrcodeModule) {
    html5QrcodeModule = await import("html5-qrcode");
  }
  return html5QrcodeModule;
}

export type CheckinResult = {
  ok: boolean;
  ja_utilizado: boolean;
  ingresso_id: string;
  participante_nome: string | null;
  evento_nome: string;
  checkin_em: string | null;
  mensagem: string;
};

export type IngressoBuscaItem = {
  ingresso_id: string;
  participante_nome: string | null;
  participante_email: string | null;
  participante_cpf: string | null;
  status: string;
  checkin_em: string | null;
  evento_id: string;
  evento_nome: string;
  lote_nome: string | null;
};

type Modo = "organizador" | "portaria";
type Aba = "camera" | "foto" | "digitar" | "buscar";

type Props = {
  modo: Modo;
  eventoId?: string;
  token?: string;
  tituloEvento?: string;
};

function loadHtml5Qrcode() {
  return importHtml5Qrcode();
}

async function executarScanner(
  scanner: Html5QrcodeInstance | null | undefined,
  metodo: "stop" | "clear",
): Promise<void> {
  if (!scanner) return;
  const fn = metodo === "stop" ? scanner.stop?.bind(scanner) : scanner.clear?.bind(scanner);
  if (!fn) return;
  try {
    await Promise.resolve(fn());
  } catch {
    /* scanner já parado ou nunca iniciou câmera */
  }
}

function ehMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** iPhone envia HEIC — converte para JPEG antes do leitor QR. */
async function normalizarImagemParaJpeg(file: File): Promise<File> {
  if (file.type === "image/jpeg" || file.type === "image/png") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const maxLado = 1600;
    let { width, height } = bitmap;
    if (width > maxLado || height > maxLado) {
      const escala = maxLado / Math.max(width, height);
      width = Math.round(width * escala);
      height = Math.round(height * escala);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível processar a imagem.");
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Não foi possível converter a foto."))),
        "image/jpeg",
        0.92,
      );
    });
    return new File([blob], "qr.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

function mensagemErroLeituraFoto(err: unknown): string {
  const bruto =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Erro desconhecido";
  const msg = bruto.toLowerCase();

  if (
    msg.includes("no multiformat readers") ||
    msg.includes("notfoundexception") ||
    msg.includes("qr code not found") ||
    msg.includes("not detected")
  ) {
    return "QR não encontrado na foto. Enquadre só o quadrado do QR, com boa luz e sem reflexo.";
  }
  if (msg.includes("failed to load") || msg.includes("image") || msg.includes("heic")) {
    return "Formato de foto não suportado. Tente «Escolher da galeria» ou use a aba Digitar.";
  }
  return bruto.length > 180
    ? "Não foi possível ler o QR na foto. Use a aba Digitar e cole o código EBR1:…"
    : bruto;
}

const FILE_SCANNER_ELEMENT_ID = "html5-qrcode-file-scan-sink";

function garantirElementoLeituraArquivo(): string {
  if (typeof document === "undefined") return FILE_SCANNER_ELEMENT_ID;
  let el = document.getElementById(FILE_SCANNER_ELEMENT_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = FILE_SCANNER_ELEMENT_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;";
    document.body.appendChild(el);
  }
  return FILE_SCANNER_ELEMENT_ID;
}

async function decodificarQrDeArquivo(file: File): Promise<string> {
  const { Html5Qrcode } = await loadHtml5Qrcode();
  const preparado = await normalizarImagemParaJpeg(file);
  const elementId = garantirElementoLeituraArquivo();
  const scanner = new Html5Qrcode(elementId);

  try {
    try {
      return await scanner.scanFile(preparado, false);
    } catch (primeiro) {
      const v2 = await scanner.scanFileV2(preparado, false);
      if (typeof v2 === "string") return v2;
      if (v2 && typeof v2 === "object" && "decodedText" in v2) {
        const texto = (v2 as { decodedText?: string }).decodedText;
        if (texto) return texto;
      }
      throw primeiro;
    }
  } finally {
    await executarScanner(scanner, "clear");
  }
}

function abaInicial(): Aba {
  if (typeof window === "undefined") return "digitar";
  if (window.isSecureContext) return "camera";
  return "foto";
}

export function CheckinPortariaClient({ modo, eventoId, token, tituloEvento }: Props) {
  const scannerDivId = useId().replace(/:/g, "");
  const [aba, setAba] = useState<Aba>("digitar");
  const [inicializado, setInicializado] = useState(false);
  const [cameraAoVivoOk, setCameraAoVivoOk] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<CheckinResult | null>(null);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [modoFesta, setModoFesta] = useState(false);
  const [buscaQ, setBuscaQ] = useState("");
  const [buscaBusy, setBuscaBusy] = useState(false);
  const [buscaResultados, setBuscaResultados] = useState<IngressoBuscaItem[]>([]);
  const [buscaErro, setBuscaErro] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const cooldownRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const autoFotoDisparadoRef = useRef(false);

  useEffect(() => {
    setCameraAoVivoOk(window.isSecureContext);
    setAba(abaInicial());
    setInicializado(true);
  }, []);

  /** Em HTTP local no celular: abre a câmera nativa ao entrar (via input capture). */
  useEffect(() => {
    if (!inicializado || cameraAoVivoOk || aba !== "foto" || !ehMobile()) return;
    if (autoFotoDisparadoRef.current || fotoBusy || busy) return;
    autoFotoDisparadoRef.current = true;
    const t = window.setTimeout(() => fotoInputRef.current?.click(), 600);
    return () => window.clearTimeout(t);
  }, [inicializado, cameraAoVivoOk, aba, fotoBusy, busy]);

  const validarCodigo = useCallback(
    async (raw: string) => {
      const texto = raw.trim();
      if (!texto) {
        setError("Informe ou leia um código de ingresso.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        let r: CheckinResult;
        if (modo === "portaria") {
          if (!eventoId || !token) {
            throw new Error("Link da portaria incompleto.");
          }
          r = await apiFetch<CheckinResult>("/api/portaria/validar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ evento_id: eventoId, token, codigo: texto }),
          });
        } else {
          r = await apiFetch<CheckinResult>("/api/checkin/validar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ codigo: texto }),
          });
        }
        setLast(r);
        if (r.ok) {
          feedbackCheckinSucesso();
        }
        setCodigo("");
        inputRef.current?.focus();
      } catch (err) {
        setLast(null);
        setError(err instanceof Error ? err.message : "Não foi possível validar.");
      } finally {
        setBusy(false);
      }
    },
    [modo, eventoId, token],
  );

  const validarPorId = useCallback(
    async (ingressoId: string) => {
      setBusy(true);
      setError(null);
      try {
        let r: CheckinResult;
        if (modo === "portaria") {
          if (!eventoId || !token) {
            throw new Error("Link da portaria incompleto.");
          }
          r = await apiFetch<CheckinResult>("/api/portaria/validar-id", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ evento_id: eventoId, token, ingresso_id: ingressoId }),
          });
        } else {
          r = await apiFetch<CheckinResult>("/api/checkin/validar-id", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ingresso_id: ingressoId }),
          });
        }
        setLast(r);
        if (r.ok) {
          feedbackCheckinSucesso();
        }
      } catch (err) {
        setLast(null);
        setError(err instanceof Error ? err.message : "Não foi possível validar.");
      } finally {
        setBusy(false);
      }
    },
    [modo, eventoId, token],
  );

  const buscarIngressos = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      if (q.length < 2) {
        setBuscaErro("Digite pelo menos 2 caracteres (nome, e-mail ou CPF).");
        return;
      }
      setBuscaBusy(true);
      setBuscaErro(null);
      setBuscaResultados([]);
      try {
        let data: { resultados: IngressoBuscaItem[] };
        if (modo === "portaria") {
          if (!eventoId || !token) {
            throw new Error("Link da portaria incompleto.");
          }
          data = await apiFetch<{ resultados: IngressoBuscaItem[] }>("/api/portaria/buscar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ evento_id: eventoId, token, q }),
          });
        } else {
          data = await apiFetch<{ resultados: IngressoBuscaItem[] }>("/api/checkin/buscar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ q }),
          });
        }
        setBuscaResultados(data.resultados);
        if (!data.resultados.length) {
          setBuscaErro("Nenhum ingresso encontrado. Tente outro nome, e-mail ou CPF.");
        }
      } catch (err) {
        setBuscaErro(err instanceof Error ? err.message : "Não foi possível buscar.");
      } finally {
        setBuscaBusy(false);
      }
    },
    [modo, eventoId, token],
  );

  const onScanSuccess = useCallback(
    (decoded: string) => {
      if (cooldownRef.current || busy) return;
      cooldownRef.current = true;
      void validarCodigo(decoded).finally(() => {
        window.setTimeout(() => {
          cooldownRef.current = false;
        }, 2000);
      });
    },
    [busy, validarCodigo],
  );

  useEffect(() => {
    if (aba !== "camera" || !cameraAoVivoOk) {
      void executarScanner(scannerRef.current, "stop");
      void executarScanner(scannerRef.current, "clear");
      scannerRef.current = null;
      setCameraReady(false);
      return;
    }

    let cancelled = false;
    setCameraErro(null);

    void (async () => {
      try {
        const { Html5Qrcode } = await loadHtml5Qrcode();
        if (cancelled) return;
        const scanner = new Html5Qrcode(scannerDivId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          onScanSuccess,
          () => {},
        );
        if (!cancelled) setCameraReady(true);
      } catch (e) {
        if (!cancelled) {
          setCameraErro(
            e instanceof Error
              ? e.message
              : "Câmera indisponível. Use «Foto do QR» ou «Digitar».",
          );
          setAba("foto");
        }
      }
    })();

    return () => {
      cancelled = true;
      void executarScanner(scannerRef.current, "stop");
      void executarScanner(scannerRef.current, "clear");
      scannerRef.current = null;
    };
  }, [aba, cameraAoVivoOk, scannerDivId, onScanSuccess]);

  async function lerFotoQr(file: File | null) {
    if (!file) return;
    setFotoBusy(true);
    setError(null);
    setLast(null);
    try {
      const texto = await decodificarQrDeArquivo(file);
      await validarCodigo(texto);
    } catch (err) {
      setError(mensagemErroLeituraFoto(err));
    } finally {
      setFotoBusy(false);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    }
  }

  async function colarCodigo() {
    try {
      const texto = await navigator.clipboard.readText();
      if (texto.trim()) {
        setCodigo(texto.trim());
        setError(null);
      }
    } catch {
      setError("Não foi possível colar. Toque no campo e use «Colar» do teclado.");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void validarCodigo(codigo);
  }

  function onSubmitBusca(e: FormEvent) {
    e.preventDefault();
    void buscarIngressos(buscaQ);
  }

  const mostrarAbaCamera = cameraAoVivoOk;
  const shellClass = modoFesta
    ? "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-zinc-950 p-4 text-white pb-[max(1rem,env(safe-area-inset-bottom))]"
    : "space-y-6";

  return (
    <div className={shellClass}>
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
        <h1 className={`text-2xl font-bold tracking-tight sm:text-3xl ${modoFesta ? "text-white" : "text-zinc-900"}`}>
          Validação na entrada
        </h1>
        {tituloEvento ? (
          <p className="mt-1 text-base font-medium text-emerald-800">{tituloEvento}</p>
        ) : null}
        <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${modoFesta ? "text-zinc-300" : "text-zinc-600"}`}>
          Leia o QR do ingresso ou cole o código <strong>EBR1:…</strong>. Cada ingresso só entra uma
          vez.
        </p>
        {modo === "organizador" && !modoFesta ? (
          <p className="mt-2 text-xs font-medium text-emerald-800">
            No dia do evento, ative o <strong>Modo festa</strong> para tela cheia e leitura mais rápida na
            portaria.
          </p>
        ) : null}
          </div>
          <label className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${modoFesta ? "border-zinc-700 bg-zinc-900" : "border-zinc-200 bg-white"}`}>
            <input
              type="checkbox"
              checked={modoFesta}
              onChange={(e) => setModoFesta(e.target.checked)}
            />
            Modo festa
          </label>
        </div>
      </header>

      {!cameraAoVivoOk && inicializado ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="note"
        >
          <strong>Câmera ao vivo bloqueada pelo navegador</strong> — em teste local (HTTP + IP{" "}
          {typeof window !== "undefined" ? window.location.hostname : ""}) o Safari/Chrome não
          liberam a câmera contínua. Ao abrir esta página, a <strong>câmera nativa</strong> deve
          abrir para fotografar o QR. Se não abrir, toque em <strong>Tirar foto do QR</strong>.
        </div>
      ) : null}

      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        {mostrarAbaCamera ? (
          <button
            type="button"
            className={`flex-1 rounded-md px-2 py-2 text-sm font-medium ${
              aba === "camera" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
            }`}
            onClick={() => setAba("camera")}
          >
            Câmera
          </button>
        ) : null}
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-2 text-sm font-medium ${
            aba === "foto" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
          }`}
          onClick={() => setAba("foto")}
        >
          Foto do QR
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-2 text-sm font-medium ${
            aba === "digitar" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
          }`}
          onClick={() => setAba("digitar")}
        >
          Digitar
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-2 py-2 text-sm font-medium ${
            aba === "buscar" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
          }`}
          onClick={() => setAba("buscar")}
        >
          Buscar
        </button>
      </div>

      {aba === "camera" && mostrarAbaCamera ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          {cameraErro ? (
            <p className="mb-3 text-sm text-amber-800" role="alert">
              {cameraErro}
            </p>
          ) : null}
          <div id={scannerDivId} className="min-h-[280px] w-full overflow-hidden rounded-lg" />
          {!cameraReady && !cameraErro ? (
            <p className="mt-2 text-center text-sm text-zinc-500">A iniciar câmera…</p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">
            Aponte para o QR do ingresso. Validação automática ao detectar.
          </p>
        </div>
      ) : null}

      {aba === "foto" ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-medium text-zinc-900">Fotografar o QR do ingresso</p>
          <p className="mt-1 text-sm text-zinc-600">
            Funciona no celular mesmo em teste local (sem HTTPS). Enquadre o QR com boa luz.
          </p>
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => void lerFotoQr(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={fotoBusy || busy}
            onClick={() => fotoInputRef.current?.click()}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 text-base font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60"
          >
            {fotoBusy ? "Lendo QR…" : "📷 Tirar foto do QR"}
          </button>
          <button
            type="button"
            disabled={fotoBusy || busy}
            onClick={() => {
              if (fotoInputRef.current) {
                fotoInputRef.current.removeAttribute("capture");
                fotoInputRef.current.click();
                fotoInputRef.current.setAttribute("capture", "environment");
              }
            }}
            className="mt-2 w-full rounded-lg border border-emerald-200 py-2.5 text-sm font-medium text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
          >
            Escolher foto da galeria
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Alternativa: abra o app <strong>Câmera</strong> do iPhone, leia o QR (abre a página do
            ingresso), copie o código <strong>EBR1:…</strong> e use a aba Digitar.
          </p>
        </div>
      ) : null}

      {aba === "digitar" ? (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <label htmlFor="checkin-codigo" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Código do ingresso
          </label>
          <input
            id="checkin-codigo"
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-3 font-mono text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            placeholder="EBR1:… ou cole o código do ingresso"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <button
            type="button"
            onClick={() => void colarCodigo()}
            className="mt-2 text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            Colar da área de transferência
          </button>
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 h-11 w-full rounded-lg bg-emerald-700 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {busy ? "Validando…" : "Validar entrada"}
          </button>
        </form>
      ) : null}

      {aba === "buscar" ? (
        <div className="space-y-4">
          <form
            onSubmit={onSubmitBusca}
            className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <label htmlFor="checkin-busca" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Nome, e-mail ou CPF
            </label>
            <input
              id="checkin-busca"
              type="search"
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
              placeholder="Ex.: Maria, maria@email.com ou 12345678901"
              value={buscaQ}
              onChange={(e) => setBuscaQ(e.target.value)}
            />
            {buscaErro ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                {buscaErro}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={buscaBusy}
              className="mt-4 h-11 w-full rounded-lg bg-emerald-700 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {buscaBusy ? "Buscando…" : "Buscar ingresso"}
            </button>
          </form>

          {buscaResultados.length > 0 ? (
            <ul className="space-y-2">
              {buscaResultados.map((item) => {
                const jaEntrou = item.status === "usado";
                return (
                  <li
                    key={item.ingresso_id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
                  >
                    <p className="font-semibold text-zinc-900">
                      {item.participante_nome || "Sem nome"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {item.participante_email || "—"}
                      {item.participante_cpf ? ` · CPF ${item.participante_cpf}` : ""}
                    </p>
                    {modo === "organizador" ? (
                      <p className="mt-1 text-xs text-zinc-500">{item.evento_nome}</p>
                    ) : null}
                    {item.lote_nome ? (
                      <p className="mt-1 text-xs text-zinc-500">Lote: {item.lote_nome}</p>
                    ) : null}
                    {jaEntrou ? (
                      <p className="mt-2 text-sm font-medium text-amber-800">
                        Já entrou
                        {item.checkin_em
                          ? ` · ${new Date(item.checkin_em).toLocaleString("pt-BR")}`
                          : ""}
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void validarPorId(item.ingresso_id)}
                        className="mt-3 w-full rounded-lg bg-emerald-700 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:px-6"
                      >
                        {busy ? "Validando…" : "Validar entrada"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {last ? (
        <aside
          className={`rounded-2xl border p-5 sm:p-6 ${
            modoFesta
              ? last.ja_utilizado
                ? "border-amber-400 bg-amber-500 text-zinc-950"
                : "border-emerald-400 bg-emerald-500 text-white"
              : last.ja_utilizado
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
          }`}
          role="status"
        >
          <p className={`font-semibold text-zinc-900 ${modoFesta ? "text-center text-3xl sm:text-4xl" : "text-lg"}`}>
            {last.mensagem}
          </p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            <li>
              <span className="font-medium">Participante:</span> {last.participante_nome || "—"}
            </li>
            <li>
              <span className="font-medium">Evento:</span> {last.evento_nome}
            </li>
            {last.checkin_em ? (
              <li>
                <span className="font-medium">Horário:</span>{" "}
                {new Date(last.checkin_em).toLocaleString("pt-BR")}
              </li>
            ) : null}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
