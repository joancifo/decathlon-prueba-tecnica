import Link from "next/link";
import { redirect } from "next/navigation";

import { verifyAccessToken } from "@/lib/mock-idp";
import { getAuthSession, readStoredAuthSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getAuthSession();
  const storedSession = readStoredAuthSession(session);

  if (!storedSession) {
    redirect("/");
  }

  let user;

  try {
    user = await verifyAccessToken(storedSession.accessToken);
  } catch {
    redirect("/api/auth/logout");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16 text-zinc-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Panel de control</h1>
        </div>

        <dl className="grid gap-4 rounded-xl border border-zinc-200 p-5 text-sm">
          <div>
            <dt className="font-medium text-zinc-500">Usuario</dt>
            <dd className="mt-1 text-base">{user.name}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Correo electrónico</dt>
            <dd className="mt-1 text-base">{user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-500">Expira</dt>
            <dd className="mt-1 text-base">
              {new Date(storedSession.expiresAt).toLocaleString("es-ES")}
            </dd>
          </div>
        </dl>

        <div className="flex gap-3">
          <Link
            href="/api/auth/logout"
            className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
          >
            Cerrar sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
