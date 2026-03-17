import dynamic from "next/dynamic";

const LoginPageClient = dynamic(
  () =>
    import("./login-page-client").then((module) => ({
      default: module.LoginPageClient,
    })),
  {
    ssr: process.env.NODE_ENV === "production",
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    ),
  },
);

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

function normalizeRedirectPath(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  return <LoginPageClient redirectTo={normalizeRedirectPath(params.redirect)} />;
}
