"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  Activity,
  ExternalLink,
  KeyRound,
  LogOut,
  RefreshCcw,
  Save,
  ShieldCheck,
} from "lucide-react";
import { getAppHealth, getMyProfile, updateMyProfile } from "@/lib/api";
import { CreateGameWizard } from "@/components/games/create-game-wizard";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDashboardDisplayName } from "@/lib/dashboard";
import { useAppAuth } from "@/lib/privy-provider";
import { buildSettingsHealthItems, buildSettingsPlatformItems, SETTINGS_DOC_LINKS } from "@/lib/settings";
import type { UserProfile } from "@/lib/types";

function normalizeField(value: string | null | undefined): string {
  return value ?? "";
}

function getHealthTone(status: "ok" | "error" | "not_configured") {
  switch (status) {
    case "ok":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
    case "error":
      return "border-rose-400/20 bg-rose-400/10 text-rose-200";
    case "not_configured":
      return "border-amber-400/20 bg-amber-400/10 text-amber-200";
    default:
      return "border-white/10 bg-white/5 text-white/75";
  }
}

function getHealthLabel(status: "ok" | "error" | "not_configured") {
  switch (status) {
    case "ok":
      return "Healthy";
    case "error":
      return "Unavailable";
    case "not_configured":
      return "Not configured";
    default:
      return "Unknown";
  }
}

function SettingsSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/8 bg-[#311519]/95 p-5 shadow-[0_18px_60px_rgba(24,8,10,0.22)] md:p-6">
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-2 break-all text-sm text-white">{value}</p>
    </div>
  );
}

function SettingsProfileForm({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved: (profile: UserProfile) => Promise<void>;
}) {
  const [displayNameInput, setDisplayNameInput] = useState(profile.display_name ?? "");
  const [avatarUrlInput, setAvatarUrlInput] = useState(profile.avatar_url ?? "");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  const isDirty =
    normalizeField(profile.display_name) !== displayNameInput ||
    normalizeField(profile.avatar_url) !== avatarUrlInput;

  function resetForm() {
    setDisplayNameInput(profile.display_name ?? "");
    setAvatarUrlInput(profile.avatar_url ?? "");
    setSaveError(null);
    setSaveMessage(null);
  }

  function handleProfileSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaveMessage(null);

    startSaveTransition(() => {
      void (async () => {
        try {
          const updated = await updateMyProfile(profile.id, {
            display_name: displayNameInput,
            avatar_url: avatarUrlInput.trim() ? avatarUrlInput.trim() : null,
          });
          await onSaved(updated);
          setSaveMessage("Profile saved.");
        } catch (error) {
          setSaveError(
            error instanceof Error
              ? error.message
              : "Unable to save your profile right now.",
          );
        }
      })();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleProfileSave}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-display-name" className="text-white/80">
            Display name
          </Label>
          <Input
            id="settings-display-name"
            value={displayNameInput}
            onChange={(event) => setDisplayNameInput(event.target.value)}
            placeholder="Your creator name"
            className="border-white/10 bg-[#1c0b0f] text-white placeholder:text-white/35"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-avatar-url" className="text-white/80">
            Avatar URL
          </Label>
          <Input
            id="settings-avatar-url"
            type="url"
            value={avatarUrlInput}
            onChange={(event) => setAvatarUrlInput(event.target.value)}
            placeholder="https://example.com/avatar.png"
            className="border-white/10 bg-[#1c0b0f] text-white placeholder:text-white/35"
          />
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-white/8 bg-[#1c0b0f] px-4 py-3 text-sm text-white/60">
        Changes persist to your authenticated `user_profiles` row and are isolated to your account.
      </div>

      {(saveMessage || saveError) && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            saveError
              ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          }`}
        >
          {saveError ?? saveMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={!isDirty || isSaving}>
          <Save className="mr-2 size-4" />
          {isSaving ? "Saving..." : "Save profile"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!isDirty || isSaving}
          onClick={resetForm}
          className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        >
          <RefreshCcw className="mr-2 size-4" />
          Reset
        </Button>
      </div>
    </form>
  );
}

/* ── Skeleton primitives matching the real settings layout ──────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[1.5rem] bg-[#311519]/60 ${className ?? ""}`} />;
}

function SettingsProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </div>
        <div className="space-y-2">
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-10 w-full rounded-lg" />
        </div>
      </div>
      <SkeletonBlock className="h-12 w-full" />
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 w-32 rounded-lg" />
        <SkeletonBlock className="h-10 w-24 rounded-lg" />
      </div>
    </div>
  );
}

function SettingsPlatformSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="mt-3 h-4 w-28" />
          <SkeletonBlock className="mt-2 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

function SettingsIdentitySkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="mt-2 h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function SettingsHealthSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <SkeletonBlock className="h-4 w-20" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="mt-3 h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

function SettingsHeroSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Privy user</p>
        <SkeletonBlock className="mt-3 h-4 w-40" />
      </div>
      <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">Profile updated</p>
        <SkeletonBlock className="mt-3 h-4 w-32" />
      </div>
    </div>
  );
}

/* ── Main shell ────────────────────────────────────────────────────── */

export function SettingsShell() {
  const router = useRouter();
  const { user, ready, authenticated, logout, isDevBypass } = useAppAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const shouldLoad = ready && authenticated && !!user?.id;

  const {
    data: profile,
    error: profileError,
    mutate: mutateProfile,
  } = useSWR(
    shouldLoad ? ["my-profile", user.id] : null,
    ([, userId]) => getMyProfile(userId),
    { revalidateOnFocus: false },
  );

  const {
    data: health,
    error: healthError,
    isLoading: isHealthLoading,
    mutate: mutateHealth,
  } = useSWR(shouldLoad ? "app-health" : null, getAppHealth, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/login?redirect=/settings");
    }
  }, [authenticated, ready, router]);

  const isLoading = !ready || !authenticated || !profile;

  const displayName = profile
    ? getDashboardDisplayName({
        id: user?.id ?? "",
        displayName: profile.display_name ?? null,
        email: user?.email?.address ?? profile?.email ?? null,
        walletAddress: user?.wallet?.address ?? profile?.wallet_address ?? null,
        avatarUrl: profile.avatar_url ?? null,
      })
    : "Creator";

  const platformItems = buildSettingsPlatformItems(health ?? null);
  const healthItems = buildSettingsHealthItems(health ?? null);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#3a1a1f_0%,#1b0b0f_50%,#0f0508_100%)] px-3 py-4 text-stone-50 md:px-5 md:py-5">
      <div className="mx-auto flex max-w-[1920px] gap-5">
        <DashboardSidebar onCreateClick={() => setIsCreateOpen(true)} />

        <main className="min-w-0 flex-1 space-y-5">
          <DashboardHeader displayName={displayName} />

          {/* Hero section — always rendered, data fills in */}
          <section className="overflow-hidden rounded-[2rem] border border-white/8 bg-[#311519]/95 shadow-[0_24px_90px_rgba(24,8,10,0.3)]">
            <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/45">
                  Creator Settings
                </p>
                <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  Manage your profile and keep the platform’s core runtime details in one place.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/60 md:text-base">
                  This page keeps account edits, system health, supported models, and operating docs attached to the same creator surface.
                </p>
              </div>

              {isLoading ? (
                <SettingsHeroSkeleton />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                      Privy user
                    </p>
                    <p className="mt-3 break-all text-sm text-white">{user?.id ?? "Unavailable"}</p>
                  </div>
                  <div className="rounded-[1.75rem] border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                      Profile updated
                    </p>
                    <p className="mt-3 text-sm text-white">
                      {profile?.updated_at
                        ? new Date(profile.updated_at).toLocaleString()
                        : "Not available"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Profile error banner */}
          {profileError && !profile && (
            <div className="rounded-[2rem] border border-rose-400/20 bg-rose-400/10 p-6 text-center">
              <p className="text-sm text-rose-200">
                {profileError instanceof Error ? profileError.message : "The profile request failed."}
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => { void mutateProfile(); }}
              >
                Retry
              </Button>
            </div>
          )}

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
            <div className="space-y-5">
              {/* Profile form */}
              <SettingsSection
                eyebrow="Profile"
                title="Creator profile"
                description="Update the public-facing identity attached to your account. Only profile fields are editable here in v1."
              >
                {isLoading ? (
                  <SettingsProfileSkeleton />
                ) : profile ? (
                  <SettingsProfileForm
                    key={`${profile.id}:${profile.updated_at}:${profile.display_name ?? ""}:${profile.avatar_url ?? ""}`}
                    profile={profile}
                    onSaved={async (updatedProfile) => {
                      await mutateProfile(updatedProfile, { revalidate: false });
                    }}
                  />
                ) : null}
              </SettingsSection>

              {/* Platform overview */}
              <SettingsSection
                eyebrow="Platform"
                title="Platform overview"
                description="Read-only runtime facts surfaced from the app configuration and current health contract."
              >
                {isHealthLoading && !health ? (
                  <SettingsPlatformSkeleton />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {platformItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/40">
                          {item.label}
                        </p>
                        <p className="mt-3 text-sm font-medium text-white">{item.value}</p>
                        <p className="mt-2 text-sm leading-6 text-white/55">{item.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </SettingsSection>

              {/* Docs — fully static, no data needed */}
              <SettingsSection
                eyebrow="Operations"
                title="Docs and runbooks"
                description="Quick links to the repo-hosted references that explain how this platform is wired and deployed."
              >
                <div className="grid gap-3 md:grid-cols-3">
                  {SETTINGS_DOC_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">{link.label}</p>
                          <p className="mt-2 text-sm leading-6 text-white/55">
                            {link.description}
                          </p>
                        </div>
                        <ExternalLink className="mt-0.5 size-4 text-white/35 transition group-hover:text-white/70" />
                      </div>
                    </Link>
                  ))}
                </div>
              </SettingsSection>
            </div>

            <div className="space-y-5">
              {/* Identity */}
              <SettingsSection
                eyebrow="Identity"
                title="Connected identities"
                description="These values are read-only here and reflect the active authenticated session."
              >
                {isLoading ? (
                  <SettingsIdentitySkeleton />
                ) : (
                  <div className="space-y-3">
                    <ReadOnlyRow
                      label="Email"
                      value={user?.email?.address ?? profile?.email ?? "No email attached"}
                    />
                    <ReadOnlyRow
                      label="Wallet"
                      value={user?.wallet?.address ?? profile?.wallet_address ?? "No wallet attached"}
                    />
                    <ReadOnlyRow
                      label="Privy DID"
                      value={user?.id ?? "Unavailable"}
                    />
                    <ReadOnlyRow
                      label="Auth mode"
                      value={isDevBypass ? "Local dev auth bypass" : "Privy authentication"}
                    />
                  </div>
                )}
              </SettingsSection>

              {/* Health */}
              <SettingsSection
                eyebrow="Health"
                title="System health"
                description="Safe service checks from the internal health route. No secrets are exposed here."
              >
                {isHealthLoading && !health ? (
                  <SettingsHealthSkeleton />
                ) : (
                  <>
                    <div className="space-y-3">
                      {healthItems.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {item.key === "web" ? (
                                <Activity className="size-4 text-white/55" />
                              ) : item.key === "supabase" ? (
                                <ShieldCheck className="size-4 text-white/55" />
                              ) : (
                                <KeyRound className="size-4 text-white/55" />
                              )}
                              <p className="text-sm font-medium text-white">{item.label}</p>
                            </div>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${getHealthTone(item.status)}`}
                            >
                              {getHealthLabel(item.status)}
                            </span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-white/55">{item.description}</p>
                        </div>
                      ))}
                    </div>

                    {healthError && (
                      <p className="mt-4 text-sm text-white/45">
                        {healthError instanceof Error
                          ? healthError.message
                          : "Unable to refresh health right now."}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { void mutateHealth(); }}
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    <RefreshCcw className="mr-2 size-4" />
                    Refresh health
                  </Button>
                </div>
              </SettingsSection>

              {/* Account actions */}
              <SettingsSection
                eyebrow="Account"
                title="Account actions"
                description="Use sign out to end the active creator session from this device."
              >
                <div className="space-y-3">
                  <div className="rounded-[1.5rem] border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-white/55">
                    {isDevBypass
                      ? "Local development auth bypass is active, so sign-out is disabled for this session."
                      : "Signing out returns you to the login flow and clears the active authenticated session."}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => logout()}
                      disabled={isDevBypass}
                      className="bg-rose-500 text-white hover:bg-rose-400"
                    >
                      <LogOut className="mr-2 size-4" />
                      Sign out
                    </Button>
                  </div>
                </div>
              </SettingsSection>
            </div>
          </div>
        </main>
      </div>

      <CreateGameWizard
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        initialGenre={null}
      />
    </div>
  );
}
