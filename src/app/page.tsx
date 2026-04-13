import { redirect } from "next/navigation";
import { getAuthSession, readStoredAuthSession } from "@/lib/session";

export default async function Home(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAuthSession();
  const storedSession = readStoredAuthSession(session);
  const { error } = await props.searchParams;

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
              Introduce tus credenciales de acceso
            </p>
          </div>

          {error && (
            <div
              id="login-error"
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-900"
            >
              {error === "invalid_credentials"
                ? "Correo o contraseña incorrectos"
                : "Ha ocurrido un error inesperado"}
            </div>
          )}

          <form action="/api/auth/login" method="POST" className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Correo electrónico
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                required
                defaultValue="demo@test.com"
                autoComplete="email"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-sm transition-all focus-visible:border-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40"
              />
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-zinc-700"
              >
                Contraseña
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                required
                defaultValue="password123"
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
                className="block w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-sm transition-all focus-visible:border-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/40"
              />
            </div>
            <button
              type="submit"
              className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] motion-reduce:active:scale-100"
            >
              Acceder
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <div className="bg-zinc-50 rounded-xl p-4 text-[11px] text-zinc-500 leading-relaxed">
              <span className="font-semibold block mb-1 text-zinc-700 uppercase">Credenciales demo:</span>
              demo@test.com / password123
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
