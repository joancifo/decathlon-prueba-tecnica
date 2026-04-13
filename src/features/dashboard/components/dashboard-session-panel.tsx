import Link from "next/link";

import { PageCard } from "@/components/ui/page-card";
import type { AuthenticatedUser } from "@/types/auth";

type DashboardSessionPanelProps = {
  user: Pick<AuthenticatedUser, "name" | "email">;
  expiresAt: number;
};

export function DashboardSessionPanel({
  user,
  expiresAt,
}: DashboardSessionPanelProps) {
  return (
    <PageCard>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Panel de control</h1>
        <p className="text-sm text-zinc-600">
          Sesión activa con el proveedor de identidad.
        </p>
      </div>

      <dl className="mt-6 grid gap-4 rounded-xl border border-zinc-200 p-5 text-sm">
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
            {new Date(expiresAt).toLocaleString("es-ES")}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex gap-3">
        <Link
          href="/api/auth/logout"
          className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white"
        >
          Cerrar sesión
        </Link>
      </div>
    </PageCard>
  );
}
