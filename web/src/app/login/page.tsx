import { LoginPageClient } from "./login-page-client";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

function normalizeRedirectPath(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/games";
  }
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginPageClient redirectTo={normalizeRedirectPath(params.redirect)} />;
}
