/**
 * Deploy flow orchestrator for Meteora Dynamic Bonding Curve.
 *
 * Full flow: upload metadata → create config tx → sign → create pool tx → sign
 *            → record to API → poll Jupiter → activate
 *
 * NOTE: The actual Meteora DBC SDK (@meteora-ag/dynamic-bonding-curve-sdk)
 * integration will be added once the SDK is installed. For now this module
 * provides the type signatures and a stub implementation.
 */

import { getSolanaConnection } from "./connection";
import { recordDeploy, activateToken } from "../api";

export interface DeployConfig {
  gameName: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription?: string;
  tokenImageUrl?: string;
  curveMode: number;
  initialMcap: number;
  migrationMcap: number;
  totalSupply: number;
  tokenDecimals: number;
  supplyOnMigrationPct: number;
}

export interface DeployCallbacks {
  onStep: (step: string, detail?: string) => void;
  onError: (error: Error) => void;
  onComplete: (result: DeployResult) => void;
}

export interface DeployResult {
  configKey: string;
  poolAddress: string;
  baseMint: string;
  txSignatures: string[];
}

type SignAndSendFn = (tx: unknown) => Promise<string>;

const DEPLOY_STEPS = [
  "Uploading token metadata...",
  "Creating DBC config transaction...",
  "Signing config transaction...",
  "Creating pool transaction...",
  "Signing pool transaction...",
  "Recording deployment...",
  "Waiting for Jupiter detection...",
  "Activating token...",
] as const;

/**
 * Deploy a token with a bonding curve on Solana.
 * Returns the deploy result or throws on failure.
 */
export async function deployToken(
  config: DeployConfig,
  walletAddress: string,
  _signAndSend: SignAndSendFn,
  callbacks: DeployCallbacks,
): Promise<void> {
  const _connection = getSolanaConnection();

  try {
    // Step 1: Upload metadata (stub — will use Metaplex UMI / Irys)
    callbacks.onStep(DEPLOY_STEPS[0]);
    // const metadataUri = await uploadTokenMetadata(config);

    // Step 2-5: Create and sign transactions (stub — requires DBC SDK)
    callbacks.onStep(DEPLOY_STEPS[1]);
    // TODO: Implement with @meteora-ag/dynamic-bonding-curve-sdk
    // const configTx = await buildConfigTransaction(config, walletAddress);
    // callbacks.onStep(DEPLOY_STEPS[2]);
    // const configSig = await signAndSend(configTx);
    // callbacks.onStep(DEPLOY_STEPS[3]);
    // const poolTx = await buildPoolTransaction(configKey, walletAddress);
    // callbacks.onStep(DEPLOY_STEPS[4]);
    // const poolSig = await signAndSend(poolTx);

    // For now, throw a clear message that SDK integration is pending
    throw new Error(
      "On-chain deployment requires the Meteora DBC SDK. " +
      "Install @meteora-ag/dynamic-bonding-curve-sdk to enable deployment.",
    );

    // Step 6: Record deployment in our API
    // callbacks.onStep(DEPLOY_STEPS[5]);
    // await recordDeploy(config.gameName, {
    //   dbc_config_key: configKey,
    //   pool_address: poolAddress,
    //   base_mint: baseMint,
    //   creator_wallet: walletAddress,
    // });

    // Step 7: Poll Jupiter until pool is detected
    // callbacks.onStep(DEPLOY_STEPS[6]);
    // await pollJupiterForPool(baseMint);

    // Step 8: Activate
    // callbacks.onStep(DEPLOY_STEPS[7]);
    // await activateToken(config.gameName);

    // callbacks.onComplete({ configKey, poolAddress, baseMint, txSignatures: [configSig, poolSig] });
  } catch (error) {
    callbacks.onError(error as Error);
  }
}

/** Poll Jupiter API until the pool appears (max 60s) */
async function pollJupiterForPool(
  mintAddress: string,
  maxWaitMs = 60_000,
  intervalMs = 5_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(
        `https://datapi.jup.ag/v1/pools?assetId=${mintAddress}&provider=met-dbc`,
      );
      if (res.ok) {
        const data = await res.json();
        if (data.pools?.length > 0) return;
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Timed out waiting for Jupiter to detect the pool");
}
