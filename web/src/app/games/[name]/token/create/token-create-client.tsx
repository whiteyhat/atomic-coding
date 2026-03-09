"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Coins, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppAuth } from "@/lib/privy-provider";
import { upsertTokenLaunch, configureCurve } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TokenCreateClientProps {
  gameName: string;
  gameId: string;
}

interface FormData {
  // Step 1 — Token Info
  token_name: string;
  token_symbol: string;
  token_description: string;
  token_image_url: string;
  // Step 2 — Curve Configuration
  curve_mode: number;
  initial_mcap: number;
  migration_mcap: number;
  total_token_supply: number;
  supply_on_migration_pct: number;
}

const STEPS = ["Token Info", "Curve Configuration", "Review & Launch"] as const;

const CURVE_MODES: { value: number; label: string }[] = [
  { value: 0, label: "Constant Product" },
  { value: 1, label: "Fixed Price" },
  { value: 2, label: "Linear" },
  { value: 3, label: "Exponential" },
];

export function TokenCreateClient({ gameName, gameId }: TokenCreateClientProps) {
  const router = useRouter();
  const { authenticated, user, login } = useAppAuth();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    token_name: "",
    token_symbol: "",
    token_description: "",
    token_image_url: "",
    curve_mode: 0,
    initial_mcap: 30,
    migration_mcap: 300,
    total_token_supply: 1_000_000_000,
    supply_on_migration_pct: 100,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deployed, setDeployed] = useState(false);

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === 0) {
      return form.token_name.trim().length > 0 && form.token_symbol.trim().length > 0;
    }
    if (step === 1) {
      return (
        form.initial_mcap > 0 &&
        form.migration_mcap > form.initial_mcap &&
        form.total_token_supply > 0 &&
        form.supply_on_migration_pct >= 20 &&
        form.supply_on_migration_pct <= 100
      );
    }
    return true;
  }

  async function handleNext() {
    if (step === 0) {
      // Save token info draft on step 1 completion
      if (!authenticated || !user) {
        login();
        return;
      }
      setSaving(true);
      setError(null);
      try {
        await upsertTokenLaunch(gameName, user.id, form.token_name, form.token_symbol);
        setStep(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save token info");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (step === 1) {
      // Save curve config on step 2 completion
      setSaving(true);
      setError(null);
      try {
        await configureCurve(gameName, {
          curve_mode: form.curve_mode,
          initial_mcap: form.initial_mcap,
          migration_mcap: form.migration_mcap,
          total_token_supply: form.total_token_supply,
          supply_on_migration_pct: form.supply_on_migration_pct,
        });
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save curve config");
      } finally {
        setSaving(false);
      }
      return;
    }
  }

  function handleDeploy() {
    setDeployed(true);
  }

  if (deployed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="flex items-center justify-center size-16 rounded-full bg-green-500/10 mx-auto">
            <Check className="size-8 text-green-400" />
          </div>
          <h1 className="text-xl font-semibold">Token Configuration Saved</h1>
          <p className="text-sm text-muted-foreground">
            On-chain deployment requires wallet connection and is coming soon.
            Your token configuration has been saved and is ready to deploy when
            the Solana SDK integration is complete.
          </p>
          <Link href={`/games/${encodeURIComponent(gameName)}/token`}>
            <Button className="mt-2">View Token Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 h-12 px-4 border-b border-white/5">
        <Link href={`/games/${encodeURIComponent(gameName)}`}>
          <Button variant="ghost" size="icon" className="size-8">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <Coins className="size-4" />
        <span className="text-sm font-medium">Launch Token — {gameName}</span>
      </header>

      {/* Step indicator */}
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center size-7 rounded-full text-xs font-medium border transition-colors",
                  i < step
                    ? "bg-green-500/15 text-green-400 border-green-500/25"
                    : i === step
                      ? "bg-white/10 text-foreground border-white/20"
                      : "bg-white/[0.02] text-muted-foreground border-white/5"
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  i === step ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
              {i < STEPS.length - 1 && (
                <div className="w-8 h-px bg-white/10" />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step 0: Token Info */}
        {step === 0 && (
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-base">Token Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token_name">Token Name</Label>
                <Input
                  id="token_name"
                  placeholder="e.g. Space Raiders Token"
                  value={form.token_name}
                  onChange={(e) => updateField("token_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token_symbol">Token Symbol</Label>
                <Input
                  id="token_symbol"
                  placeholder="e.g. RAID"
                  value={form.token_symbol}
                  onChange={(e) => updateField("token_symbol", e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token_description">Description (optional)</Label>
                <textarea
                  id="token_description"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none"
                  placeholder="Tell people what this token is about..."
                  value={form.token_description}
                  onChange={(e) => updateField("token_description", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="token_image_url">Token Image URL (optional)</Label>
                <Input
                  id="token_image_url"
                  type="url"
                  placeholder="https://..."
                  value={form.token_image_url}
                  onChange={(e) => updateField("token_image_url", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Curve Configuration */}
        {step === 1 && (
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-base">Bonding Curve Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Curve Mode</Label>
                <Select
                  value={String(form.curve_mode)}
                  onValueChange={(v) => updateField("curve_mode", Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURVE_MODES.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="initial_mcap">Initial Market Cap (SOL)</Label>
                  <Input
                    id="initial_mcap"
                    type="number"
                    min={1}
                    value={form.initial_mcap}
                    onChange={(e) => updateField("initial_mcap", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="migration_mcap">Migration Market Cap (SOL)</Label>
                  <Input
                    id="migration_mcap"
                    type="number"
                    min={1}
                    value={form.migration_mcap}
                    onChange={(e) => updateField("migration_mcap", Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_token_supply">Total Token Supply</Label>
                <Input
                  id="total_token_supply"
                  type="number"
                  min={1}
                  value={form.total_token_supply}
                  onChange={(e) => updateField("total_token_supply", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Default: 1,000,000,000
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supply_on_migration_pct">
                  Supply on Migration (%)
                </Label>
                <Input
                  id="supply_on_migration_pct"
                  type="number"
                  min={20}
                  max={100}
                  value={form.supply_on_migration_pct}
                  onChange={(e) =>
                    updateField(
                      "supply_on_migration_pct",
                      Math.max(20, Math.min(100, Number(e.target.value)))
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Percentage of supply available during bonding phase (20-100%)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Review & Launch */}
        {step === 2 && (
          <Card className="border-white/5 bg-white/[0.02]">
            <CardHeader>
              <CardTitle className="text-base">Review & Launch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token info summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Token Info</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium">{form.token_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Symbol</span>
                    <p className="font-medium">${form.token_symbol}</p>
                  </div>
                  {form.token_description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Description</span>
                      <p className="font-medium">{form.token_description}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* Curve config summary */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Bonding Curve</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Curve Mode</span>
                    <p className="font-medium">
                      {CURVE_MODES.find((m) => m.value === form.curve_mode)?.label}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Initial Market Cap</span>
                    <p className="font-medium">{form.initial_mcap} SOL</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Migration Market Cap</span>
                    <p className="font-medium">{form.migration_mcap} SOL</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Supply</span>
                    <p className="font-medium">{form.total_token_supply.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Supply on Migration</span>
                    <p className="font-medium">{form.supply_on_migration_pct}%</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/5" />

              <Button onClick={handleDeploy} className="w-full gap-2">
                <Rocket className="size-4" />
                Deploy Token
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Coming soon — on-chain deployment requires wallet connection.
                Your configuration will be saved.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between py-6">
          <Button
            variant="ghost"
            onClick={() => (step > 0 ? setStep(step - 1) : router.push(`/games/${encodeURIComponent(gameName)}`))}
            className="gap-1"
          >
            <ChevronLeft className="size-4" />
            {step > 0 ? "Previous" : "Back"}
          </Button>

          {step < 2 && (
            <Button
              onClick={handleNext}
              disabled={!canAdvance() || saving}
              className="gap-1"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Next
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
