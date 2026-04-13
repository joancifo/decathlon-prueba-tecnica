import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { LoginPanel } from "@/features/auth/components/login-panel";
import { getAuthSession, readStoredAuthSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getAuthSession();
  const storedSession = readStoredAuthSession(session);

  if (storedSession) {
    redirect("/app/dashboard");
  }

  return (
    <PageShell className="flex items-center justify-center">
      <div className="w-full max-w-sm">
        <LoginPanel />
      </div>
    </PageShell>
  );
}
