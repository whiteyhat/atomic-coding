import { getSupabaseClient } from "../supabase-client.ts";
import { log } from "../logger.ts";
import { cached } from "../cache.ts";
import { triggerRebuild } from "./atoms.ts";

// =============================================================================
// Types
// =============================================================================

export interface RegistryEntry {
  id: string;
  name: string;
  display_name: string;
  package_name: string;
  version: string;
  cdn_url: string;
  global_name: string;
  description: string | null;
}

export interface InstalledExternal {
  name: string;
  display_name: string;
  package_name: string;
  version: string;
  cdn_url: string;
  global_name: string;
  description: string | null;
  load_type: string;
  module_imports: Record<string, string> | null;
  installed_at: string;
}

export interface ExternalDetail extends InstalledExternal {
  api_surface: string;
}

// =============================================================================
// Service functions
// =============================================================================

/** List all available libraries from the curated registry */
export async function listRegistry(): Promise<RegistryEntry[]> {
  return cached("registry:externals", 300, async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("external_registry")
      .select("id, name, display_name, package_name, version, cdn_url, global_name, description")
      .order("name", { ascending: true });

    if (error) throw new Error(`Failed to list registry: ${error.message}`);
    return (data || []) as RegistryEntry[];
  });
}

/** Install an external library into a game (by registry name) */
export async function installExternal(
  gameId: string,
  registryName: string,
): Promise<InstalledExternal> {
  const supabase = getSupabaseClient();

  // 1. Look up the registry entry
  const { data: entry, error: lookupError } = await supabase
    .from("external_registry")
    .select("id, name, display_name, package_name, version, cdn_url, global_name, description")
    .eq("name", registryName)
    .single();

  if (lookupError || !entry) {
    throw new Error(
      `External "${registryName}" not found in registry. Use GET /registry/externals to see available libraries.`,
    );
  }

  // 2. Insert the game_external record
  const { error: insertError } = await supabase
    .from("game_externals")
    .insert({ game_id: gameId, registry_id: entry.id });

  if (insertError) {
    if (insertError.code === "23505") {
      throw new Error(`"${registryName}" is already installed in this game.`);
    }
    throw new Error(`Failed to install external: ${insertError.message}`);
  }

  log("info", "external installed", { gameId, name: registryName });

  // 3. Trigger rebuild so manifest is regenerated
  triggerRebuild(gameId);

  return {
    name: entry.name,
    display_name: entry.display_name,
    package_name: entry.package_name,
    version: entry.version,
    cdn_url: entry.cdn_url,
    global_name: entry.global_name,
    description: entry.description,
    installed_at: new Date().toISOString(),
  };
}

/** Uninstall an external library from a game (by registry name) */
export async function uninstallExternal(
  gameId: string,
  registryName: string,
): Promise<void> {
  const supabase = getSupabaseClient();

  // 1. Look up the registry entry
  const { data: entry, error: lookupError } = await supabase
    .from("external_registry")
    .select("id")
    .eq("name", registryName)
    .single();

  if (lookupError || !entry) {
    throw new Error(`External "${registryName}" not found in registry.`);
  }

  // 2. Delete the game_external record
  const { data: deleted, error: deleteError } = await supabase
    .from("game_externals")
    .delete()
    .eq("game_id", gameId)
    .eq("registry_id", entry.id)
    .select("id");

  if (deleteError) {
    throw new Error(`Failed to uninstall external: ${deleteError.message}`);
  }

  if (!deleted || deleted.length === 0) {
    throw new Error(`"${registryName}" is not installed in this game.`);
  }

  log("info", "external uninstalled", { gameId, name: registryName });

  // 3. Trigger rebuild so manifest is regenerated
  triggerRebuild(gameId);
}

/** Get installed externals for a game (without api_surface, for listings) */
export async function getInstalledExternals(
  gameId: string,
): Promise<InstalledExternal[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("game_externals")
    .select(
      "installed_at, external_registry(name, display_name, package_name, version, cdn_url, global_name, description, load_type, module_imports)",
    )
    .eq("game_id", gameId)
    .order("installed_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch installed externals: ${error.message}`);

  return (data || []).map((row: any) => {
    const reg = row.external_registry;
    return {
      name: reg.name,
      display_name: reg.display_name,
      package_name: reg.package_name,
      version: reg.version,
      cdn_url: reg.cdn_url,
      global_name: reg.global_name,
      description: reg.description,
      load_type: reg.load_type || "script",
      module_imports: reg.module_imports || null,
      installed_at: row.installed_at,
    };
  });
}

/** Read full detail (including api_surface) for specific installed externals */
export async function readExternals(
  gameId: string,
  names: string[],
): Promise<ExternalDetail[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("game_externals")
    .select(
      "installed_at, external_registry!inner(name, display_name, package_name, version, cdn_url, global_name, description, api_surface, load_type, module_imports)",
    )
    .eq("game_id", gameId);

  if (error) throw new Error(`Failed to read externals: ${error.message}`);

  // Filter to requested names
  const results = (data || [])
    .map((row: any) => {
      const reg = row.external_registry;
      return {
        name: reg.name,
        display_name: reg.display_name,
        package_name: reg.package_name,
        version: reg.version,
        cdn_url: reg.cdn_url,
        global_name: reg.global_name,
        description: reg.description,
        api_surface: reg.api_surface,
        load_type: reg.load_type || "script",
        module_imports: reg.module_imports || null,
        installed_at: row.installed_at,
      };
    })
    .filter((ext: ExternalDetail) => names.includes(ext.name));

  return results;
}
