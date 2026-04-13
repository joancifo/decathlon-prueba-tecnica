import { redirect } from "next/navigation";

import { getAuthSession, readStoredAuthSession } from "@/lib/session";

export default async function Home() {
  const session = await getAuthSession();
  const storedSession = readStoredAuthSession(session);

  if (storedSession) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-2xl bg-white p-10 shadow-sm ring-1 ring-zinc-200/50">
          <div className="flex flex-col items-center text-center mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Continúa con el proveedor de identidad para acceder al panel
            </p>
          </div>

          <form action="/api/auth/login" method="GET">
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              Continuar con el IdP
            </button>
          </form>

        
        </div>
      </div>
    </main>
  );
}
