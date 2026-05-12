import { Suspense } from "react";

import AuthClient from "./auth-client";

function AuthFallback() {
  return (
    <div
      className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-zinc-50 p-8 animate-pulse"
      aria-hidden
    >
      <div className="mb-6 h-8 w-3/4 rounded bg-zinc-200" />
      <div className="h-10 w-full rounded bg-zinc-200" />
      <div className="mt-4 h-10 w-full rounded bg-zinc-200" />
      <div className="mt-6 h-10 w-full rounded bg-zinc-200" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthClient />
    </Suspense>
  );
}
