"use client";

import { PageShell } from "@/components/layout/page-shell";

type DashboardErrorProps = {
  error: Error;
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <PageShell className="px-6 py-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">No pudimos cargar el panel</h1>
          <p className="text-sm text-zinc-600">
            Se produjo un error inesperado. Puedes reintentar o volver a iniciar sesión.
          </p>
        </div>

        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          {error.message || "Error desconocido"}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
          >
            Reintentar
          </button>
          <a
            href="/api/auth/logout"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    </PageShell>
  );
}
