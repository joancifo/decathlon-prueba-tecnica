import { PageShell } from "@/components/layout/page-shell";
import { AuthErrorPanel } from "@/features/auth/components/auth-error-panel";

type AuthErrorPageProps = {
  searchParams?: {
    reason?: string;
  };
};

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  invalid_state: {
    title: "No pudimos validar el inicio de sesión",
    description:
      "La sesión temporal de autenticación no coincide. Vuelve a intentarlo desde el inicio.",
  },
  token_exchange_failed: {
    title: "No pudimos completar la autenticación",
    description:
      "El proveedor de identidad no pudo emitir los tokens de acceso en este intento.",
  },
  session_invalid: {
    title: "Tu sesión ya no es válida",
    description:
      "Detectamos que la sesión actual no se puede verificar. Cierra sesión para volver a entrar.",
  },
};

function getErrorCopy(reason?: string) {
  if (!reason) {
    return {
      title: "Se produjo un error de autenticación",
      description: "Vuelve a iniciar sesión para continuar.",
    };
  }

  return ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.invalid_state;
}

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const copy = getErrorCopy(searchParams?.reason);

  return (
    <PageShell className="flex items-center justify-center">
      <AuthErrorPanel title={copy.title} description={copy.description} />
    </PageShell>
  );
}
