import { PageShell } from "@/components/layout/page-shell";

export default function DashboardLoading() {
  return (
    <PageShell className="px-6 py-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Cargando panel</h1>
          <p className="text-sm text-zinc-600">
            Estamos preparando tu sesión y tus datos de usuario.
          </p>
        </div>

        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-100" />
        </div>
      </div>
    </PageShell>
  );
}
