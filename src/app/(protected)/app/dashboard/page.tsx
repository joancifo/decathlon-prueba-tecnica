import { redirect } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { DashboardSessionPanel } from "@/features/dashboard/components/dashboard-session-panel";
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
    redirect("/auth/error?reason=session_invalid");
  }

  return (
    <PageShell className="px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <DashboardSessionPanel user={user} expiresAt={storedSession.expiresAt} />
      </div>
    </PageShell>
  );
}
