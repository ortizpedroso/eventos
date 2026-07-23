/** Fallback instantâneo na navegação client-side — mesma altura do formulário de auth. */
export default function AuthLoading() {
  return (
    <div className="w-full flex-1 py-8 sm:py-12" aria-busy aria-label="Carregando login">
      <div className="mb-8 text-center">
        <div className="mx-auto h-9 w-56 rounded-lg bg-zinc-200" />
        <div className="mx-auto mt-3 h-4 w-72 max-w-full rounded bg-zinc-100" />
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="space-y-4">
          <div className="h-10 rounded-md bg-zinc-100" />
          <div className="h-10 rounded-md bg-zinc-100" />
          <div className="h-10 rounded-md bg-emerald-100" />
        </div>
      </div>
    </div>
  );
}
