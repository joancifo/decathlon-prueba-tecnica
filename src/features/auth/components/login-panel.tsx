import { PageCard } from "@/components/ui/page-card";

export function LoginPanel() {
  return (
    <PageCard className="p-10">
      <header className="mb-8 flex flex-col items-center text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Continúa con el proveedor de identidad para acceder al panel
        </p>
      </header>

      <form action="/api/auth/login" method="GET">
        <button
          type="submit"
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Continuar con el IdP
        </button>
      </form>
    </PageCard>
  );
}
