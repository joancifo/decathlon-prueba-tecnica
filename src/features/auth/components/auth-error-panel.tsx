import Link from "next/link";

import { PageCard } from "@/components/ui/page-card";

type AuthErrorPanelProps = {
  title: string;
  description: string;
};

export function AuthErrorPanel({ title, description }: AuthErrorPanelProps) {
  return (
    <PageCard className="max-w-lg p-10">
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-zinc-600">{description}</p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <a
          href="/api/auth/login"
          className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
        >
          Intentar de nuevo
        </a>
        <Link
          href="/api/auth/logout"
          className="inline-flex w-full items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 sm:w-auto"
        >
          Limpiar sesión y volver
        </Link>
      </div>
    </PageCard>
  );
}
