# Bonding Curve — Full-Stack Implementation Specification

> Comprehensive specification for integrating Meteora Dynamic Bonding Curves (DBC) into Atomic Coding, enabling game creators to launch tokens with automated price discovery and DEX graduation on Solana.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Database Schema](#2-database-schema)
3. [Solana Integration Layer](#3-solana-integration-layer)
4. [Supabase Edge Function Services](#4-supabase-edge-function-services)
5. [Frontend Components](#5-frontend-components)
6. [Real-Time Data Pipeline](#6-real-time-data-pipeline)
7. [Player Token Earning (Leaderboard Integration)](#7-player-token-earning-leaderboard-integration)
8. [Configuration Reference](#8-configuration-reference)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Environment Variables & Dependencies](#10-environment-variables--dependencies)

---

## 1. Overview & Architecture

### 1.1 System Goals

Every game on Atomic Coding can optionally launch a token via a Meteora Dynamic Bonding Curve on Solana. The bonding curve provides automated price discovery — early buyers get lower prices, and as demand grows the price rises along a deterministic curve until the token "graduates" to a full DEX (Meteora DAMM V2).

**Three user roles interact with the system:**

| Role | Actions |
|------|---------|
| **Creator** | Configures curve parameters in game settings, launches the token, claims trading fees and LP tokens after graduation |
| **Player** | Earns token allocations through gameplay leaderboard performance, claims tokens after graduation |
| **Trader** | Discovers tokens via browse/explore page, buys and sells on the bonding curve, trades on DEX post-graduation |

### 1.2 Token Lifecycle

```
[1. Configure]     Creator sets curve params in game settings
       ↓
[2. Deploy]        On-chain DBC config + pool created via Meteora SDK
       ↓
[3. Trade]         Token tradeable on bonding curve (buy/sell via DBC)
       ↓                Jupiter auto-indexes the token
[4. Track]         Frontend shows chart, progress bar, holders, mcap
       ↓
[5. Graduate]      Market cap hits migration threshold → liquidity migrates to DAMM V2
       ↓
[6. Distribute]    Leaderboard snapshot → top players receive token allocations
       ↓
[7. DEX]           Token trades on Meteora AMM, LP tokens distributed to creator
```

### 1.3 High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                             │
│                                                                  │
│  Game Settings        Token Dashboard         Explore Page       │
│  ┌──────────┐        ┌──────────────┐        ┌────────────┐     │
│  │ Curve     │        │ Price Chart  │        │ Browse All │     │
│  │ Config    │        │ Bond Progress│        │ Game Tokens│     │
│  │ Form      │        │ Trading      │        │ by Status  │     │
│  │           │        │ Widget       │        │            │     │
│  │ Deploy    │        │ Holders Top10│        │ New / Hot  │     │
│  │ Button    │        │ Tx History   │        │ Graduated  │     │
│  └─────┬────┘        └──────┬───────┘        └─────┬──────┘     │
│        │                    │                      │             │
│        └────────────┬───────┴──────────────────────┘             │
│                     │                                            │
│              Privy Embedded Wallet (Solana)                      │
└─────────────────────┼────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌──────────────────┐   ┌─────────────────────┐
│ Supabase Edge    │   │   Solana Blockchain  │
│ Functions (Hono) │   │                      │
│                  │   │  Meteora DBC Program │
│ /token/curve/*   │   │  dbcij3LWUpp...      │
│                  │   │                      │
│ bonding-curve.ts │   │  SPL Token Mint      │
│ curve-trading.ts │   │  Token Metadata      │
│ curve-sync.ts    │   │  Pool Account        │
│                  │   │                      │
│ Supabase DB ◄────┼───┤  DAMM V2 (post-grad) │
│ (state cache)    │   └──────────┬───────────┘
└──────────────────┘              │
                                  ▼
                       ┌─────────────────────┐
                       │   Jupiter Indexer    │
                       │                     │
                       │ REST: /v1/pools     │
                       │ WS: trench-stream   │
                       │                     │
                       │ Auto-indexes DBC    │
                       │ tokens, provides    │
                       │ price/volume/mcap   │
                       └─────────────────────┘
```

### 1.4 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Blockchain** | Solana | Meteora DBC SDK native, Jupiter auto-indexing, low fees, fast finality |
| **Bonding curve** | Meteora Dynamic Bonding Curve | Battle-tested, 4 curve modes, built-in graduation to DAMM |
| **Wallet** | Privy embedded Solana wallet | Already integrated for auth, supports Solana signing |
| **Price data** | Jupiter Data API + WebSocket | Free, real-time, auto-discovers DBC tokens |
| **Chart** | TradingView Lightweight Charts | Industry standard, open-source, candlestick support |
| **State cache** | Supabase PostgreSQL | Existing infra, enables fast queries without RPC calls |
| **Graduation target** | DAMM V2 | Meteora's latest AMM with concentrated liquidity |

---

## 2. Database Schema

### 2.1 Migration: `020_bonding_curve.sql`

This migration extends the existing `token_launches` table and adds three new tables for bonding curve state management.

```sql
-- =============================================================================
-- 020: Bonding Curve — Extends token_launches with DBC config + state tables
-- =============================================================================

-- ─── Extend token_launches with bonding curve configuration ──────────────────

ALTER TABLE token_launches
  ADD COLUMN curve_mode         INT DEFAULT 1,          -- 0=linear, 1=mcap, 2=two-segment, 3=liquidity-weights
  ADD COLUMN initial_mcap       NUMERIC,                -- Starting market cap (in SOL)
  ADD COLUMN migration_mcap     NUMERIC,                -- Graduation threshold (in SOL)
  ADD COLUMN total_token_supply NUMERIC DEFAULT 1000000000, -- Total supply (human-readable, not lamports)
  ADD COLUMN token_decimals     INT DEFAULT 6,          -- Base token decimals
  ADD COLUMN supply_on_migration_pct INT DEFAULT 80,    -- % of supply released at migration
  ADD COLUMN migration_option   INT DEFAULT 1,          -- 0=DAMM V1, 1=DAMM V2
  ADD COLUMN migration_fee_option INT DEFAULT 3,        -- LP fee tier (0-5: 0.25%-6%)
  ADD COLUMN creator_fee_pct    INT DEFAULT 50,         -- Creator share of trading fees (0-100%)
  ADD COLUMN creator_lp_pct     INT DEFAULT 50,         -- Creator LP % after graduation
  ADD COLUMN base_fee_mode      INT DEFAULT 0,          -- 0=Linear, 1=Exponential, 2=RateLimiter
  ADD COLUMN starting_fee_bps   INT DEFAULT 100,        -- Starting fee in bps (100 = 1%)
  ADD COLUMN ending_fee_bps     INT DEFAULT 100,        -- Ending fee in bps
  ADD COLUMN dynamic_fee        BOOLEAN DEFAULT true,   -- Enable dynamic fee (adds 20% of min base fee)
  ADD COLUMN token_image_url    TEXT,                    -- Token icon (uploaded to Irys)
  ADD COLUMN token_description  TEXT,                    -- Token description for metadata
  ADD COLUMN token_website      TEXT,                    -- Project website URL
  ADD COLUMN token_twitter      TEXT,                    -- Twitter/X handle
  ADD COLUMN token_telegram     TEXT,                    -- Telegram group link
  ADD COLUMN dbc_config_key     TEXT,                    -- On-chain DBC config pubkey
  ADD COLUMN pool_address       TEXT,                    -- On-chain pool pubkey
  ADD COLUMN base_mint          TEXT,                    -- SPL token mint address
  ADD COLUMN quote_mint         TEXT DEFAULT 'So11111111111111111111111111111111111111112', -- SOL
  ADD COLUMN creator_wallet     TEXT,                    -- Creator's Solana wallet pubkey
  ADD COLUMN deployed_at        TIMESTAMPTZ,            -- When pool went live on-chain
  ADD COLUMN graduated_at       TIMESTAMPTZ,            -- When pool migrated to DAMM
  ADD COLUMN graduated_pool     TEXT;                    -- DAMM pool address post-graduation

-- Update status check to include new states
ALTER TABLE token_launches
  DROP CONSTRAINT IF EXISTS token_launches_status_check;
ALTER TABLE token_launches
  ADD CONSTRAINT token_launches_status_check
  CHECK (status IN ('draft', 'configuring', 'deploying', 'live', 'graduating', 'graduated', 'failed'));


-- ─── Bonding curve real-time state (cached from on-chain / Jupiter) ─────────

CREATE TABLE bonding_curve_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID UNIQUE NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  bonding_pct     NUMERIC DEFAULT 0,             -- 0-100 progress toward graduation
  current_mcap    NUMERIC DEFAULT 0,             -- Current market cap (in SOL)
  current_mcap_usd NUMERIC DEFAULT 0,            -- Current market cap (in USD)
  current_price   NUMERIC DEFAULT 0,             -- Current token price (in SOL)
  current_price_usd NUMERIC DEFAULT 0,           -- Current token price (in USD)
  total_supply_sold NUMERIC DEFAULT 0,           -- Tokens sold from curve
  base_reserve    NUMERIC DEFAULT 0,             -- Token reserve in pool
  quote_reserve   NUMERIC DEFAULT 0,             -- SOL reserve in pool
  volume_24h      NUMERIC DEFAULT 0,             -- 24h trading volume (SOL)
  volume_24h_usd  NUMERIC DEFAULT 0,             -- 24h trading volume (USD)
  trades_24h      INT DEFAULT 0,                 -- 24h trade count
  unique_traders  INT DEFAULT 0,                 -- All-time unique trader count
  holder_count    INT DEFAULT 0,                 -- Current holder count
  fdv             NUMERIC DEFAULT 0,             -- Fully diluted valuation
  liquidity       NUMERIC DEFAULT 0,             -- Pool liquidity (SOL)
  price_change_5m  NUMERIC DEFAULT 0,            -- 5-minute price change %
  price_change_1h  NUMERIC DEFAULT 0,            -- 1-hour price change %
  price_change_6h  NUMERIC DEFAULT 0,            -- 6-hour price change %
  price_change_24h NUMERIC DEFAULT 0,            -- 24-hour price change %
  is_graduated    BOOLEAN DEFAULT false,         -- Graduation flag
  last_synced_at  TIMESTAMPTZ DEFAULT now(),     -- Last data sync timestamp
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bcs_launch ON bonding_curve_state(launch_id);
CREATE INDEX idx_bcs_game ON bonding_curve_state(game_id);
CREATE INDEX idx_bcs_graduated ON bonding_curve_state(is_graduated);
CREATE INDEX idx_bcs_bonding_pct ON bonding_curve_state(bonding_pct DESC);


-- ─── Token transaction history ──────────────────────────────────────────────

CREATE TABLE token_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  game_id         UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  tx_signature    TEXT UNIQUE NOT NULL,          -- Solana transaction signature
  tx_type         TEXT NOT NULL CHECK (tx_type IN ('buy', 'sell')),
  wallet_address  TEXT NOT NULL,                 -- Trader wallet pubkey
  amount_in       NUMERIC NOT NULL,              -- Input amount (SOL for buy, tokens for sell)
  amount_out      NUMERIC NOT NULL,              -- Output amount (tokens for buy, SOL for sell)
  price_per_token NUMERIC NOT NULL,              -- Effective price at time of trade
  fee_amount      NUMERIC DEFAULT 0,             -- Fee paid
  mcap_at_trade   NUMERIC,                       -- Market cap at time of trade
  bonding_pct_at_trade NUMERIC,                  -- Bonding % at time of trade
  block_time      TIMESTAMPTZ NOT NULL,          -- On-chain block timestamp
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tt_launch ON token_transactions(launch_id);
CREATE INDEX idx_tt_game ON token_transactions(game_id);
CREATE INDEX idx_tt_wallet ON token_transactions(wallet_address);
CREATE INDEX idx_tt_block_time ON token_transactions(block_time DESC);
CREATE INDEX idx_tt_type ON token_transactions(tx_type);


-- ─── Token holder snapshots (cached, refreshed periodically) ────────────────

CREATE TABLE token_holders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id       UUID NOT NULL REFERENCES token_launches(id) ON DELETE CASCADE,
  wallet_address  TEXT NOT NULL,
  balance         NUMERIC NOT NULL DEFAULT 0,    -- Token balance
  percentage      NUMERIC NOT NULL DEFAULT 0,    -- % of total supply
  is_creator      BOOLEAN DEFAULT false,         -- Flag if this is the token creator
  is_contract     BOOLEAN DEFAULT false,         -- Flag if this is the bonding curve pool
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(launch_id, wallet_address)
);

CREATE INDEX idx_th_launch ON token_holders(launch_id);
CREATE INDEX idx_th_balance ON token_holders(launch_id, balance DESC);


-- ─── Enable Realtime on state table for live frontend updates ───────────────

ALTER PUBLICATION supabase_realtime ADD TABLE bonding_curve_state;
```

### 2.2 Schema Relationships

```
games (existing)
  │
  ├── token_launches (extended with curve config + on-chain addresses)
  │     │
  │     ├── bonding_curve_state (1:1 — cached real-time metrics)
  │     ├── token_transactions (1:many — buy/sell history)
  │     ├── token_holders (1:many — top holder snapshots)
  │     └── token_distributions (existing — leaderboard allocations)
  │
  └── scores (existing — feeds leaderboard for distributions)
```

### 2.3 Status Flow

```
draft → configuring → deploying → live → graduating → graduated
                                    ↓
                                  failed (at any point after deploying)
```

| Status | Description |
|--------|-------------|
| `draft` | Basic token info saved (name, symbol) — no curve config |
| `configuring` | Creator is filling out bonding curve parameters |
| `deploying` | On-chain transactions in progress (config + pool creation) |
| `live` | Pool is active, token tradeable on bonding curve |
| `graduating` | Migration threshold reached, DAMM migration in progress |
| `graduated` | Successfully migrated to DAMM V2, trading on DEX |
| `failed` | Deployment or migration failed (with error in metadata) |

---

## 3. Solana Integration Layer

### 3.1 Dependencies

```bash
# Solana core
pnpm add @solana/web3.js @solana/spl-token

# Meteora DBC SDK
pnpm add @meteora-ag/dynamic-bonding-curve-sdk

# Token metadata (Metaplex UMI for Irys upload)
pnpm add @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults
pnpm add @metaplex-foundation/mpl-token-metadata
pnpm add @irys/sdk

# Optional: Jupiter API client
pnpm add @jup-ag/api
```

### 3.2 Wallet Management

Privy already provides embedded Solana wallets for authenticated users. The creator's Privy wallet signs all on-chain transactions.

```typescript
// Frontend: Get Solana wallet from Privy
import { useSolanaWallets } from "@privy-io/react-auth";

const { wallets } = useSolanaWallets();
const solanaWallet = wallets[0]; // Primary embedded wallet

// Sign transaction
const signedTx = await solanaWallet.signTransaction(transaction);
```

For server-side operations (like state sync or migration triggers), a **platform keypair** stored as a Supabase secret handles automated actions.

### 3.3 DBC Config Creation

The DBC config is an on-chain account that defines the bonding curve parameters. It's created once per token launch.

```typescript
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const connection = new Connection(SOLANA_RPC_URL, "confirmed");
const dbcClient = new DynamicBondingCurveClient(connection, "confirmed");

// 4 curve building modes available:
// Mode 0: buildCurve — linear, uses migrationQuoteThreshold
// Mode 1: buildCurveWithMarketCap — market-cap driven (RECOMMENDED)
// Mode 2: buildCurveWithTwoSegments — two-phase with supply control
// Mode 3: buildCurveWithLiquidityWeights — custom 16-segment liquidity distribution

// Example: Mode 1 (Market-Cap Driven) — recommended default
const curveConfig = buildCurveWithMarketCap({
  totalTokenSupply: 1_000_000_000,       // 1B tokens
  tokenBaseDecimal: 6,
  tokenQuoteDecimal: 9,                  // SOL = 9 decimals
  initialMarketCap: 20,                  // 20 SOL initial mcap
  migrationMarketCap: 600,               // Graduate at 600 SOL mcap
  migrationOption: 1,                    // DAMM V2
  percentageSupplyOnMigration: 80,       // 80% supply released at migration
});

// Create on-chain config
const configKeypair = Keypair.generate();
const createConfigTx = await dbcClient.partner.createConfig({
  config: configKeypair.publicKey,
  quoteMint: new PublicKey("So11111111111111111111111111111111111111112"), // SOL
  feeClaimer: creatorWallet,
  leftoverReceiver: creatorWallet,
  payer: creatorWallet,
  ...curveConfig,
  // Fee settings
  baseFeeParams: {
    baseFeeMode: 0, // Linear
    feeSchedulerParam: {
      startingFeeBps: 100,  // 1%
      endingFeeBps: 100,    // 1%
      numberOfPeriod: 0,
      totalDuration: 0,
    },
  },
  dynamicFeeEnabled: true,
  collectFeeMode: 0,                     // Fees in quote token (SOL)
  creatorTradingFeePercentage: 50,       // Creator gets 50% of fees
  // LP distribution after graduation
  creatorLpPercentage: 50,
  partnerLpPercentage: 50,
  creatorLockedLpPercentage: 0,
  partnerLockedLpPercentage: 0,
  migrationFeeOption: 3,                 // 1% LP fee tier
  // Activation
  activationType: 1,                     // Timestamp-based
  // Token type
  tokenType: 0,                          // Standard SPL token
  tokenUpdateAuthority: 1,               // Immutable
});
```

### 3.4 Pool Creation (Token Minting + Launch)

Once config is on-chain, the creator deploys the pool which mints the token and makes it immediately tradeable.

```typescript
// 1. Generate or use existing base mint
const baseMintKeypair = Keypair.generate();

// 2. Upload token metadata to Irys via Metaplex UMI
//    (image, name, symbol, description, socials)
const metadataUri = await uploadTokenMetadata({
  name: tokenName,
  symbol: tokenSymbol,
  description: tokenDescription,
  image: tokenImageUrl,
  external_url: tokenWebsite,
  properties: {
    twitter: tokenTwitter,
    telegram: tokenTelegram,
  },
});

// 3. Create pool (mints token + creates bonding curve pool)
const createPoolTx = await dbcClient.pool.createPool({
  baseMint: baseMintKeypair.publicKey,
  config: configKeypair.publicKey,
  name: tokenName,
  symbol: tokenSymbol,
  uri: metadataUri,
  payer: creatorWallet,
  poolCreator: creatorWallet,
});

// 4. Send transaction
const txSig = await sendAndConfirmTransaction(connection, createPoolTx, [
  creatorKeypair,
  baseMintKeypair,
]);

// 5. Pool is now live — Jupiter will auto-index within minutes
```

### 3.5 Buy & Sell (Swap)

```typescript
// Get swap quote
const quote = await dbcClient.pool.swapQuote({
  virtualPool: poolState.account,
  config: poolConfig,
  swapBaseForQuote: false,      // false = BUY tokens with SOL
  amountIn: new BN(amountInLamports),
  hasReferral: false,
  currentPoint: new BN(Math.floor(Date.now() / 1000)),
});

// Execute swap
const swapTx = await dbcClient.pool.swap({
  amountIn: quote.amountIn,
  minimumAmountOut: quote.minimumAmountOut, // Slippage protection
  owner: traderWallet,
  pool: poolAddress,
  swapBaseForQuote: false,
  referralTokenAccount: null,
});

// Sell is the same with swapBaseForQuote: true
```

### 3.6 Graduation (Migration to DAMM V2)

Migration is triggered when `quoteReserve >= migrationQuoteThreshold`. This can be triggered by Meteora's automated migrator service, or manually.

```typescript
// Check if ready to graduate
const poolState = await dbcClient.state.getPoolByMint(baseMint);
const config = await dbcClient.state.getPoolConfig(poolState.account.config);

if (poolState.account.quoteReserve.gte(config.migrationQuoteThreshold)) {
  // 1. Create migration metadata
  await dbcClient.migration.createDammV2MigrationMetadata({
    payer: platformWallet,
    virtualPool: poolAddress,
  });

  // 2. Execute migration
  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
    await dbcClient.migration.migrateToDammV2({
      payer: platformWallet,
      virtualPool: poolAddress,
    });

  // 3. Claim creator LP tokens
  await dbcClient.migration.claimDammV2LpToken({
    payer: creatorWallet,
    virtualPool: poolAddress,
    isPartner: false,
  });
}
```

### 3.7 Fee Collection

```typescript
// Creator claims accumulated trading fees
await dbcClient.creator.claimCreatorTradingFee({
  pool: poolAddress,
  creator: creatorWallet,
});
```

---

## 4. Supabase Edge Function Services

### 4.1 Service: `bonding-curve.ts`

Handles curve configuration, deployment state management, and on-chain operations.

```
supabase/functions/_shared/services/bonding-curve.ts
```

**Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `configureCurve` | `(launchId, curveParams) → TokenLaunch` | Save bonding curve config to token_launches |
| `markDeploying` | `(launchId, { dbcConfigKey, poolAddress, baseMint, creatorWallet }) → TokenLaunch` | Record on-chain addresses after deployment |
| `markLive` | `(launchId) → TokenLaunch` | Mark token as live + create bonding_curve_state row |
| `markGraduated` | `(launchId, graduatedPool) → TokenLaunch` | Mark graduated + set graduated_at |
| `markFailed` | `(launchId, error) → TokenLaunch` | Mark failed + store error in metadata |
| `getCurveConfig` | `(gameId) → TokenLaunch \| null` | Get full curve config for a game |
| `getLiveTokens` | `(limit?, offset?) → TokenLaunch[]` | List all live (trading) tokens |
| `getGraduatedTokens` | `(limit?, offset?) → TokenLaunch[]` | List all graduated tokens |

```typescript
// Example: configureCurve
export async function configureCurve(
  launchId: string,
  params: {
    curve_mode: number;
    initial_mcap: number;
    migration_mcap: number;
    total_token_supply?: number;
    token_decimals?: number;
    supply_on_migration_pct?: number;
    creator_fee_pct?: number;
    creator_lp_pct?: number;
    base_fee_mode?: number;
    starting_fee_bps?: number;
    ending_fee_bps?: number;
    dynamic_fee?: boolean;
    token_image_url?: string;
    token_description?: string;
    token_website?: string;
    token_twitter?: string;
    token_telegram?: string;
  },
): Promise<TokenLaunch> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("token_launches")
    .update({
      ...params,
      status: "configuring",
    })
    .eq("id", launchId)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to configure curve: ${error.message}`);
  return data;
}
```

### 4.2 Service: `curve-sync.ts`

Syncs on-chain / Jupiter data into the local `bonding_curve_state` and `token_holders` tables.

```
supabase/functions/_shared/services/curve-sync.ts
```

**Functions:**

| Function | Signature | Description |
|----------|-----------|-------------|
| `syncPoolState` | `(launchId) → BondingCurveState` | Fetch pool data from Jupiter API, update bonding_curve_state |
| `syncHolders` | `(launchId) → TokenHolder[]` | Fetch holder list from Solana RPC, update token_holders |
| `syncAllLiveTokens` | `() → void` | Batch sync all live tokens (called by cron) |
| `getState` | `(gameId) → BondingCurveState \| null` | Get cached state for a game |
| `getHolders` | `(launchId, limit?) → TokenHolder[]` | Get top holders sorted by balance |
| `getTransactions` | `(launchId, limit?) → TokenTransaction[]` | Get recent transactions |
| `recordTransaction` | `(launchId, txData) → TokenTransaction` | Record a new buy/sell |

**Jupiter API Integration:**

```typescript
const JUPITER_API = "https://datapi.jup.ag";

// Fetch pool data by mint address
async function fetchPoolFromJupiter(mintAddress: string): Promise<JupiterPool | null> {
  const res = await fetch(
    `${JUPITER_API}/v1/pools?assetId=${mintAddress}&provider=met-dbc`
  );
  const data = await res.json();
  return data.pools?.[0] ?? null;
}

// Pool response shape (from Jupiter)
interface JupiterPool {
  id: string;
  bondingCurve: number | undefined;   // 0-100, undefined if graduated
  volume24h: number | undefined;
  baseAsset: {
    id: string;
    name: string;
    symbol: string;
    icon?: string;
    decimals: number;
    holderCount?: number;
    fdv?: number;
    mcap?: number;
    usdPrice?: number;
    liquidity?: number;
    graduatedAt?: string;
    stats5m?: { priceChangePercent: number };
    stats1h?: { priceChangePercent: number };
    stats6h?: { priceChangePercent: number };
    stats24h?: { priceChangePercent: number; volume: number; trades: number };
  };
}
```

### 4.3 API Route Specifications

Add these routes to `supabase/functions/api/index.ts`:

```typescript
// ── Bonding Curve Configuration ────────────────────────────────

// Save curve parameters
PUT   /games/:name/token/curve/config
Body: { curve_mode, initial_mcap, migration_mcap, ... }
Response: TokenLaunch

// Get full curve config + state
GET   /games/:name/token/curve
Response: { launch: TokenLaunch, state: BondingCurveState | null }

// ── Deployment ─────────────────────────────────────────────────

// Record deployment (called by frontend after on-chain tx succeeds)
POST  /games/:name/token/curve/deploy
Body: { dbc_config_key, pool_address, base_mint, creator_wallet }
Response: TokenLaunch

// Mark as live (called after Jupiter confirms indexing)
POST  /games/:name/token/curve/activate
Response: TokenLaunch

// ── Trading Data ───────────────────────────────────────────────

// Get current curve state (cached from Jupiter)
GET   /games/:name/token/curve/state
Response: BondingCurveState

// Get top holders
GET   /games/:name/token/curve/holders?limit=10
Response: TokenHolder[]

// Get transaction history
GET   /games/:name/token/curve/transactions?limit=50
Response: TokenTransaction[]

// Record a trade (called by frontend after on-chain swap)
POST  /games/:name/token/curve/transactions
Body: { tx_signature, tx_type, wallet_address, amount_in, amount_out, price_per_token }
Response: TokenTransaction

// ── Swap Quotes (server-side for security) ─────────────────────

// Get buy quote
POST  /games/:name/token/curve/quote
Body: { direction: "buy" | "sell", amount: number }
Response: { amountIn, amountOut, minimumAmountOut, priceImpact, fee }

// ── Explore / Browse ───────────────────────────────────────────

// List all tokens with bonding curves (paginated)
GET   /tokens/explore?status=live&sort=bonding_pct&limit=20&offset=0
Response: { tokens: (TokenLaunch & BondingCurveState)[], total: number }

// ── Graduation ─────────────────────────────────────────────────

// Mark graduated (called after on-chain migration)
POST  /games/:name/token/curve/graduate
Body: { graduated_pool }
Response: TokenLaunch

// Trigger leaderboard snapshot + distribution
POST  /games/:name/token/curve/distribute
Response: TokenDistribution[]
```

### 4.4 Cron: Token State Sync

A scheduled Edge Function that syncs all live tokens every 30 seconds:

```
supabase/functions/curve-sync-cron/index.ts
```

```typescript
// Called by Supabase Cron (pg_cron) every 30 seconds
// OR by Supabase Edge Function scheduler
Deno.serve(async () => {
  await syncAllLiveTokens();
  return new Response(JSON.stringify({ synced: true }));
});
```

This keeps `bonding_curve_state` up-to-date without requiring the frontend to hit Solana RPC directly.

---

## 5. Frontend Components

### 5.1 Game Settings — Curve Configuration

**Location:** `web/src/components/token/curve-config-form.tsx`

A multi-step form within the game settings for configuring the bonding curve.

**Step 1: Token Info**
- Token name (text input, auto-derived from game name)
- Token symbol (text input, 2-6 chars, uppercase)
- Token description (textarea)
- Token image (file upload → stored in Supabase Storage → uploaded to Irys on deploy)
- Social links: website, Twitter, Telegram

**Step 2: Curve Parameters**
- Curve mode selector (dropdown with 4 options, default: Market Cap)
- Initial market cap (SOL) — number input, default: 20
- Migration market cap (SOL) — number input, default: 600
- Total token supply — number input, default: 1,000,000,000
- Supply on migration (%) — slider, 20-100, default: 80

**Step 3: Fee Configuration**
- Creator trading fee % — slider, 0-100, default: 50
- Base fee mode — dropdown (Linear / Exponential / Rate Limiter)
- Starting fee — number input in bps, default: 100 (1%)
- Ending fee — number input in bps, default: 100 (1%)
- Dynamic fee toggle — checkbox, default: on

**Step 4: Post-Graduation LP**
- Creator LP % — slider, 0-100, default: 50
- Migration fee tier — dropdown (0.25%, 0.5%, 1%, 2%, 4%, 6%), default: 1%
- Leaderboard allocation % — slider, 0-10, default: 2

**Step 5: Review & Deploy**
- Summary of all parameters
- Estimated curve shape preview (simple SVG showing price vs supply)
- "Deploy Token" button → triggers on-chain transactions
- Shows progress: Creating config → Minting token → Creating pool → Waiting for Jupiter indexing → Live

### 5.2 Token Dashboard Page

**Location:** `web/src/app/games/[name]/token/page.tsx` (rewrite existing)

Replace the current skeleton with a full token dashboard:

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back    $SYMBOL — Token Dashboard            [Graduated] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────┐  ┌──────────────────┐ │
│  │                                 │  │ Key Metrics       │ │
│  │      Price Chart                │  │                  │ │
│  │   (TradingView Lightweight)     │  │ Price: 0.002 SOL │ │
│  │                                 │  │ Mcap:  142 SOL   │ │
│  │   Candlestick + Volume bars     │  │ FDV:   200 SOL   │ │
│  │   1m / 5m / 15m / 1h / 4h / 1d │  │ Vol 24h: 89 SOL  │ │
│  │                                 │  │ Holders: 247     │ │
│  │                                 │  │ Trades: 1,203    │ │
│  └─────────────────────────────────┘  └──────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Bonding Curve Progress                                │   │
│  │ ████████████████████████░░░░░░░░░  72%               │   │
│  │ 142 / 600 SOL market cap                              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────┐  ┌───────────────────────────────────┐ │
│  │ Buy / Sell      │  │ Top 10 Holders                   │ │
│  │                │  │                                   │ │
│  │ [Buy] [Sell]   │  │ 1. 7xK4...9f2  12.4%            │ │
│  │                │  │ 2. 3mN8...k1p   8.7%  (creator)  │ │
│  │ Amount:        │  │ 3. Fh2j...w8r   5.2%            │ │
│  │ [____] SOL     │  │ 4. ...                           │ │
│  │                │  │                                   │ │
│  │ You receive:   │  │                                   │ │
│  │ ~4,200 $SYM    │  │                                   │ │
│  │                │  │                                   │ │
│  │ [Connect Wallet│  │                                   │ │
│  │  to Trade]     │  │                                   │ │
│  └────────────────┘  └───────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Recent Transactions                                   │   │
│  │                                                       │   │
│  │ BUY   0.5 SOL → 2,100 $SYM   7xK4...9f2   2m ago   │   │
│  │ SELL  1,000 $SYM → 0.23 SOL  Fh2j...w8r   5m ago   │   │
│  │ BUY   1.0 SOL → 4,100 $SYM   9pQ2...m4k   8m ago   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Component Breakdown

#### `CurveChart` — Price Chart
```
web/src/components/token/curve-chart.tsx
```
- Uses `lightweight-charts` from TradingView
- Candlestick chart with volume histogram
- Time interval selector (1m, 5m, 15m, 1h, 4h, 1d)
- Data source: Jupiter API for OHLCV data (or Supabase cached)
- Real-time updates via WebSocket

```bash
pnpm add lightweight-charts
```

#### `BondProgressBar` — Graduation Progress
```
web/src/components/token/bond-progress-bar.tsx
```
- Horizontal progress bar (0-100%)
- Shows current mcap vs migration mcap
- Color gradient: blue (0-70%) → amber (70-99%) → green (100%)
- Animated fill on updates

#### `TradingWidget` — Buy/Sell Interface
```
web/src/components/token/trading-widget.tsx
```
- Tab toggle: Buy / Sell
- Amount input (SOL for buy, tokens for sell)
- Real-time quote display (calls `/curve/quote` endpoint)
- Slippage tolerance selector (0.5%, 1%, 2%, custom)
- "Connect Wallet" button if not connected
- "Buy" / "Sell" button with confirmation dialog
- Transaction status (pending → confirmed with signature link)

#### `HoldersTable` — Top 10 Holders
```
web/src/components/token/holders-table.tsx
```
- Sorted by balance descending
- Columns: Rank, Address (truncated), Balance, % of Supply
- Badge for creator, bonding curve pool
- Link to Solscan for each address

#### `TransactionHistory` — Recent Trades
```
web/src/components/token/transaction-history.tsx
```
- List of recent buys/sells
- Columns: Type (Buy/Sell with color), Amount In, Amount Out, Wallet, Time Ago
- Auto-refresh on new trades
- Link to Solscan for tx signature

#### `TokenMetrics` — Key Stats Card
```
web/src/components/token/token-metrics.tsx
```
- Grid of key metrics: Price, Mcap, FDV, 24h Volume, Holders, Trades
- Price change indicators (green/red arrows with %)
- Compact display using shadcn Card component

#### `TokenStatusBadge` — Status Indicator
```
web/src/components/token/token-status-badge.tsx
```
- Badges: Draft, Configuring, Deploying (spinner), Live (green pulse), Graduating (amber), Graduated (green check), Failed (red)

### 5.4 Explore Page (Token Discovery)

**Location:** `web/src/app/tokens/page.tsx` (new page)

A browse page for all game tokens, similar to pump.fun or dexscreener:

```
┌──────────────────────────────────────────────────────────────┐
│  Explore Game Tokens                                         │
│                                                              │
│  [New Releases] [About to Launch] [Graduated] [All]          │
│                                                              │
│  Sort by: [Bonding %] [Market Cap] [Volume] [Newest]         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 🎮 GameA │  │ 🎮 GameB │  │ 🎮 GameC │  │ 🎮 GameD │    │
│  │ $TOKA    │  │ $TOKB    │  │ $TOKC    │  │ $TOKD    │    │
│  │          │  │          │  │          │  │          │    │
│  │ ███░ 72% │  │ █████ 95%│  │ Graduated│  │ ██░░ 34% │    │
│  │          │  │          │  │          │  │          │    │
│  │ Mcap:142 │  │ Mcap:520 │  │ Mcap:1.2k│  │ Mcap: 68 │    │
│  │ Vol: 89  │  │ Vol: 230 │  │ Vol: 450 │  │ Vol: 12  │    │
│  │ +12.4%   │  │ +45.2%   │  │ -2.1%    │  │ +5.7%    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                              │
│  ← 1 2 3 ... →                                              │
└──────────────────────────────────────────────────────────────┘
```

**Categories (same as Elixir):**
- **New Releases**: `bondingPct <= 70 AND createdAt < 24h ago`
- **About to Launch**: `bondingPct > 70 OR createdAt >= 24h ago`
- **Graduated**: `is_graduated = true`

### 5.5 React Hooks

#### `useCurveState` — Live Curve Data
```typescript
// web/src/lib/hooks/use-curve-state.ts
function useCurveState(gameName: string) {
  // Polls GET /games/:name/token/curve/state every 10s
  // Also subscribes to Supabase Realtime on bonding_curve_state table
  // Returns: { state, isLoading, error, refresh }
}
```

#### `useSwapQuote` — Real-Time Quote
```typescript
// web/src/lib/hooks/use-swap-quote.ts
function useSwapQuote(gameName: string, direction: "buy" | "sell", amount: number) {
  // Debounced call to POST /games/:name/token/curve/quote
  // Returns: { quote, isLoading, error }
}
```

#### `useTokenExplore` — Browse Tokens
```typescript
// web/src/lib/hooks/use-token-explore.ts
function useTokenExplore(filters: { status?, sort?, limit?, offset? }) {
  // Calls GET /tokens/explore with filters
  // Returns: { tokens, total, isLoading, error }
}
```

---

## 6. Real-Time Data Pipeline

### 6.1 Data Sources

| Source | Data | Update Frequency | Method |
|--------|------|-----------------|--------|
| **Jupiter REST** | Pool metrics, price, volume, mcap | Polled every 30s (server cron) | `GET /v1/pools?assetId=` |
| **Jupiter WebSocket** | Live trade events, graduations | Real-time stream | `wss://trench-stream.jup.ag/ws` |
| **Solana RPC** | Holder balances, token accounts | Polled every 60s (server cron) | `getTokenLargestAccounts` |
| **Supabase Realtime** | bonding_curve_state changes | Instant (on DB write) | PostgreSQL NOTIFY |

### 6.2 Jupiter WebSocket Integration

```typescript
// Server-side WebSocket listener (runs in curve-sync-cron)
const ws = new WebSocket("wss://trench-stream.jup.ag/ws");

ws.onopen = () => {
  // Subscribe to all DBC tokens we're tracking
  const mintAddresses = await getAllLiveMintAddresses();
  ws.send(JSON.stringify({
    method: "subscribe",
    params: {
      type: "token",
      ids: mintAddresses,
    },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "update":
      // Pool state updated — sync to bonding_curve_state
      await syncPoolState(msg.data);
      break;
    case "graduated":
      // Token graduated — trigger graduation flow
      await handleGraduation(msg.data);
      break;
    case "new":
      // New pool discovered (shouldn't happen for our tokens, but log it)
      break;
  }
};
```

### 6.3 Frontend Real-Time Updates

The frontend receives updates through two channels:

1. **Supabase Realtime** — subscribes to `bonding_curve_state` changes for the current game
2. **Polling fallback** — refreshes from REST API every 10 seconds

```typescript
// Supabase Realtime subscription
const channel = supabase
  .channel("curve-state")
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "bonding_curve_state", filter: `game_id=eq.${gameId}` },
    (payload) => {
      setCurveState(payload.new);
    }
  )
  .subscribe();
```

### 6.4 Chart Data (OHLCV)

Jupiter provides OHLCV candlestick data via:

```
GET https://datapi.jup.ag/v1/pools/{poolId}/ohlcv?interval=5m&limit=300
```

Response:
```typescript
interface CandleStick {
  time: number;       // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

For real-time candle updates, new trades from the WebSocket stream are aggregated into the current candle.

---

## 7. Player Token Earning (Leaderboard Integration)

### 7.1 Flow

```
Game Published + Token Live
       ↓
Players play game, scores recorded to `scores` table
       ↓
Leaderboard tracks top players (existing system)
       ↓
Token reaches migration_mcap → graduation triggered
       ↓
Leaderboard SNAPSHOT taken at graduation moment
       ↓
Top 10 players receive token allocations (% of total supply)
       ↓
Tokens distributed via SPL transfer to player wallets
       ↓
Players claim by connecting Solana wallet
```

### 7.2 Distribution Calculation

```typescript
// At graduation time:
const leaderboard = await getLeaderboard(gameName, "lifetime", 10);
const totalSupply = tokenLaunch.total_token_supply;
const allocationPct = tokenLaunch.leaderboard_allocation_pct; // e.g., 2%
const allocationPool = totalSupply * (allocationPct / 100);   // e.g., 20,000,000 tokens

// Weighted distribution based on score ranking
const weights = [25, 20, 15, 12, 8, 6, 5, 4, 3, 2]; // % of pool per rank
for (let i = 0; i < leaderboard.length; i++) {
  const allocation = allocationPool * (weights[i] / 100);
  await createDistribution({
    launch_id: tokenLaunch.id,
    user_id: leaderboard[i].user_id,
    rank: i + 1,
    allocation_amount: allocation,
    status: "pending",
  });
}
```

### 7.3 Claiming Flow

1. Player sees "You earned X tokens!" notification in game UI
2. Player connects Solana wallet (Privy embedded or external)
3. Player clicks "Claim Tokens"
4. Backend creates SPL transfer transaction
5. Player signs transaction
6. Distribution marked as "claimed"

### 7.4 Allocation Vesting (Optional)

For anti-dump protection, player allocations can be vested:
- 50% unlocked immediately at graduation
- 50% vested linearly over 7 days
- Uses Meteora's built-in `lockedVestingParam` for on-chain enforcement

---

## 8. Configuration Reference

### 8.1 Curve Modes

| Mode | Name | When to Use | Key Params |
|------|------|-------------|------------|
| **0** | Linear | Simple threshold-based graduation | `migrationQuoteThreshold` (SOL to collect) |
| **1** | Market Cap (Default) | Price discovery with mcap targets | `initialMarketCap`, `migrationMarketCap` |
| **2** | Two-Segment | Custom supply control at migration | Mode 1 + `percentageSupplyOnMigration` |
| **3** | Liquidity Weights | Advanced: custom price curve shape | Mode 1 + `liquidityWeights[16]` |

### 8.2 Recommended Defaults

```typescript
const RECOMMENDED_DEFAULTS = {
  // Curve
  curve_mode: 1,                     // Market cap mode
  initial_mcap: 20,                  // 20 SOL (~$3,000 at $150/SOL)
  migration_mcap: 600,               // 600 SOL (~$90,000 at $150/SOL)
  total_token_supply: 1_000_000_000, // 1 billion
  token_decimals: 6,
  supply_on_migration_pct: 80,

  // Fees
  creator_fee_pct: 50,               // Creator gets 50% of trading fees
  base_fee_mode: 0,                  // Linear fee schedule
  starting_fee_bps: 100,             // 1% fee
  ending_fee_bps: 100,               // 1% fee (constant)
  dynamic_fee: true,                 // +20% dynamic fee component

  // Post-graduation LP
  creator_lp_pct: 50,                // Creator gets 50% of LP
  migration_fee_option: 3,           // 1% LP fee tier
  migration_option: 1,               // DAMM V2

  // Leaderboard
  leaderboard_allocation_pct: 2,     // 2% of supply to top 10 players
};
```

### 8.3 Fee Modes

| Mode | Name | Behavior |
|------|------|----------|
| **0** | Linear | Fee decreases linearly from `startingFeeBps` to `endingFeeBps` over `numberOfPeriod` periods |
| **1** | Exponential | Fee decreases exponentially — faster reduction early on |
| **2** | Rate Limiter | Fee spikes on rapid buying, discourages bots |

### 8.4 Migration Fee Options

| Option | LP Fee Tier | Best For |
|--------|------------|----------|
| 0 | 0.25% | High-volume tokens |
| 1 | 0.50% | Standard tokens |
| 2 | 0.75% | Above average |
| 3 | 1.00% | **Recommended default** |
| 4 | 2.00% | Low-volume tokens |
| 5 | 6.00% | Very low volume |

### 8.5 Full DBC Config Type

```typescript
interface BondingCurveConfig {
  // Token identity
  token_name: string;
  token_symbol: string;          // 2-6 chars, uppercase
  token_description: string;
  token_image_url: string;       // IPFS or Irys URL
  token_website?: string;
  token_twitter?: string;
  token_telegram?: string;

  // Curve parameters
  curve_mode: 0 | 1 | 2 | 3;
  total_token_supply: number;    // Human-readable (not lamports)
  token_decimals: number;        // Default: 6
  initial_mcap: number;          // SOL (for modes 1-3)
  migration_mcap: number;        // SOL (for modes 1-3)
  migration_quote_threshold?: number; // SOL (for mode 0)
  supply_on_migration_pct: number;   // 20-100%
  liquidity_weights?: number[];      // 16 values (for mode 3)

  // Fee configuration
  creator_fee_pct: number;       // 0-100%
  base_fee_mode: 0 | 1 | 2;
  starting_fee_bps: number;      // 1-9900
  ending_fee_bps: number;        // 1-9900
  dynamic_fee: boolean;
  collect_fee_mode: 0 | 1;      // 0=quote token, 1=output token

  // Migration / graduation
  migration_option: 0 | 1;      // 0=DAMM V1, 1=DAMM V2
  migration_fee_option: 0 | 1 | 2 | 3 | 4 | 5;

  // LP distribution
  creator_lp_pct: number;        // 0-100%
  partner_lp_pct: number;        // 0-100% (usually 100 - creator_lp_pct)
  creator_locked_lp_pct: number; // Permanently locked
  partner_locked_lp_pct: number; // Permanently locked

  // Vesting (optional)
  vesting?: {
    total_locked_amount: number;
    number_of_periods: number;
    cliff_unlock_amount: number;
    total_vesting_duration: number;   // seconds
    cliff_duration: number;           // seconds from migration
  };

  // Leaderboard
  leaderboard_allocation_pct: number; // 0-10%

  // Token type
  token_type: 0 | 1;             // 0=SPL, 1=Token-2022
  token_update_authority: 0 | 1 | 2; // 0=Creator, 1=Immutable, 2=Partner
}
```

---

## 9. Implementation Roadmap

### Phase 1: Database Schema + Service Skeleton

**Goal:** Get the data layer ready.

- [ ] Create migration `020_bonding_curve.sql`
  - Extend `token_launches` with all curve config columns
  - Create `bonding_curve_state` table
  - Create `token_transactions` table
  - Create `token_holders` table
  - Enable Realtime on `bonding_curve_state`
- [ ] Create `bonding-curve.ts` service
  - `configureCurve()`, `markDeploying()`, `markLive()`, `markGraduated()`, `markFailed()`
  - `getCurveConfig()`, `getLiveTokens()`, `getGraduatedTokens()`
- [ ] Create `curve-sync.ts` service
  - `syncPoolState()`, `syncHolders()`, `getState()`, `getHolders()`, `getTransactions()`
  - `recordTransaction()`
- [ ] Add API routes to `supabase/functions/api/index.ts`
  - All routes from section 4.3
- [ ] Update `TokenLaunch` type in `web/src/lib/types.ts`
  - Add all new fields from the extended schema
- [ ] Update `tokens.ts` service for new status states
- [ ] Run migration against Supabase: `supabase db push`

### Phase 2: Solana Integration (Config + Pool Creation)

**Goal:** Enable on-chain token deployment from the frontend.

- [ ] Install Solana + Meteora SDK dependencies
  - `@solana/web3.js`, `@solana/spl-token`, `@meteora-ag/dynamic-bonding-curve-sdk`
  - `@metaplex-foundation/umi`, `@irys/sdk`
- [ ] Create Solana utility module: `web/src/lib/solana/`
  - `connection.ts` — RPC connection singleton
  - `dbc-client.ts` — DynamicBondingCurveClient wrapper
  - `metadata.ts` — Irys metadata upload helper
  - `deploy.ts` — createConfig + createPool flow
- [ ] Integrate Privy Solana wallet
  - Ensure embedded Solana wallet is enabled in Privy config
  - Create `useSolanaSign` hook for transaction signing
- [ ] Build deployment flow
  - Frontend calls `deploy.ts` functions → signs with Privy wallet → sends to Solana
  - On success, calls `POST /token/curve/deploy` to record addresses
  - Poll Jupiter API until token is indexed → call `POST /token/curve/activate`
- [ ] Add platform keypair to Supabase secrets
  - For automated actions (graduation, sync)

### Phase 3: Frontend — Settings + Token Dashboard

**Goal:** Build the UI for configuration and viewing.

- [ ] Build `CurveConfigForm` component
  - 5-step wizard (Token Info → Curve Params → Fees → LP → Review & Deploy)
  - Form state management with React Hook Form + Zod validation
  - Deploy button triggers Solana transactions
- [ ] Rewrite `games/[name]/token/page.tsx`
  - Replace skeleton with full token dashboard
  - Show config form if status is `draft` or `configuring`
  - Show dashboard if status is `live` or `graduated`
- [ ] Build `TokenMetrics` component
  - Grid of key stats from `bonding_curve_state`
- [ ] Build `BondProgressBar` component
  - Animated progress bar with color transitions
- [ ] Build `TokenStatusBadge` component
  - Status-aware badges for all states
- [ ] Build `HoldersTable` component
  - Top 10 holders with rank, address, balance, %
- [ ] Build `TransactionHistory` component
  - Recent buy/sell list with type indicators
- [ ] Install `lightweight-charts` package
- [ ] Build `CurveChart` component
  - TradingView candlestick chart
  - Time interval selector
  - Volume histogram

### Phase 4: Trading Widget + Real-Time Data

**Goal:** Enable buying/selling and live updates.

- [ ] Build `TradingWidget` component
  - Buy/Sell tabs, amount input, quote display
  - Slippage selector
  - Wallet connection check
  - Transaction signing + confirmation
- [ ] Create `useCurveState` hook
  - Combines polling + Supabase Realtime subscription
- [ ] Create `useSwapQuote` hook
  - Debounced quote fetching
- [ ] Build swap execution flow
  - Frontend generates swap tx via Meteora SDK
  - User signs with Privy wallet
  - On confirmation, records trade via `POST /token/curve/transactions`
- [ ] Implement Jupiter WebSocket listener in backend
  - `curve-sync-cron` Edge Function
  - Subscribes to all live token mints
  - Updates `bonding_curve_state` on each message
- [ ] Set up Supabase Realtime subscription on frontend
  - Subscribe to `bonding_curve_state` changes for current game

### Phase 5: Graduation + Leaderboard Distribution

**Goal:** Handle the graduation lifecycle and player rewards.

- [ ] Implement graduation detection
  - Server-side: detect `bondingCurve === 100` from Jupiter data
  - OR: listen for `graduated` WebSocket event
- [ ] Build graduation handler
  - Create DAMM V2 migration metadata
  - Execute migration transaction (platform keypair)
  - Claim creator LP tokens
  - Update token_launches status to `graduated`
- [ ] Build leaderboard snapshot
  - Query top 10 from `scores` at graduation moment
  - Calculate weighted allocations
  - Insert into `token_distributions`
- [ ] Build claiming UI
  - Notification banner: "You earned X tokens!"
  - Claim button with wallet connection
  - SPL transfer execution
- [ ] Build distribution tracking
  - Show allocation status (pending, distributed, claimed)
  - Creator dashboard showing all distributions

### Phase 6: Explore Page + Polish

**Goal:** Token discovery and final polish.

- [ ] Build `/tokens` explore page
  - Category tabs (New / About to Launch / Graduated / All)
  - Sort options (Bonding %, Mcap, Volume, Newest)
  - Grid of token cards with mini progress bars
  - Pagination
- [ ] Create `useTokenExplore` hook
- [ ] Add "Token" link to game sidebar/header
- [ ] Add token status indicators to game list (home page)
- [ ] Error handling & edge cases
  - Transaction failures with retry
  - Stale quote handling
  - Network disconnection recovery
- [ ] Responsive design for mobile
- [ ] Creator fee claiming UI
  - Dashboard for accumulated trading fees
  - Claim button
- [ ] SEO: token page meta tags for social sharing

---

## 10. Environment Variables & Dependencies

### 10.1 Environment Variables

**Frontend (`web/.env.local`):**

```bash
# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta          # or devnet

# Jupiter
NEXT_PUBLIC_JUPITER_API_URL=https://datapi.jup.ag

# Privy (existing)
NEXT_PUBLIC_PRIVY_APP_ID=...
```

**Supabase Edge Functions (`supabase/.env`):**

```bash
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PLATFORM_KEYPAIR_SECRET=...                      # Base58-encoded keypair for automated actions

# Jupiter
JUPITER_API_URL=https://datapi.jup.ag
JUPITER_WS_URL=wss://trench-stream.jup.ag/ws

# Irys (for metadata upload)
IRYS_RPC_URL=https://node1.irys.xyz
```

### 10.2 NPM Dependencies

**Frontend (`web/package.json`):**

```bash
# Solana + Meteora
pnpm add @solana/web3.js @solana/spl-token
pnpm add @meteora-ag/dynamic-bonding-curve-sdk

# Metaplex (token metadata upload)
pnpm add @metaplex-foundation/umi @metaplex-foundation/umi-bundle-defaults
pnpm add @metaplex-foundation/mpl-token-metadata

# Chart
pnpm add lightweight-charts

# Privy Solana adapter (if not already)
pnpm add @privy-io/react-auth
```

**Supabase Edge Functions (Deno — import from URLs):**

```typescript
// Deno uses URL imports — no package.json needed
// Use esm.sh for npm packages in Deno:
import { Connection } from "https://esm.sh/@solana/web3.js";
import { DynamicBondingCurveClient } from "https://esm.sh/@meteora-ag/dynamic-bonding-curve-sdk";
```

### 10.3 External Service Requirements

| Service | Purpose | Free Tier? |
|---------|---------|------------|
| **Solana RPC** | On-chain reads/writes | Yes (rate-limited). Use Helius/QuickNode for production |
| **Jupiter Data API** | Price, volume, mcap, OHLCV | Yes, public API |
| **Jupiter WebSocket** | Real-time trade stream | Yes, public WebSocket |
| **Irys** | Token metadata storage | Paid per upload (cheap, ~$0.001/KB) |
| **Privy** | Wallet management | Existing integration |
| **Supabase** | Database, Edge Functions, Realtime | Existing integration |

---

## Appendix A: Meteora DBC Program

- **Program ID:** `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
- **Networks:** Mainnet & Devnet (same program ID)
- **SDK:** `@meteora-ag/dynamic-bonding-curve-sdk`
- **Source:** [meteora-ag/meteora-pool-setup (GitHub)](https://github.com/AdrenaFoundation/meteora-pool-setup)

## Appendix B: Jupiter Data API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/pools?assetId={mint}` | Get pool by token mint address |
| `GET /v1/pools?provider=met-dbc` | Get all Meteora DBC pools |
| `GET /v1/pools/{poolId}/ohlcv?interval=5m` | OHLCV candlestick data |
| `GET /v1/pools/{poolId}/trades?limit=50` | Recent trade history |
| `GET /v1/tokens/{mint}/holders` | Token holder list |
| `WSS trench-stream.jup.ag/ws` | Real-time pool updates |

## Appendix C: Reference Implementations

- **Elixir Integration Guide:** `/Users/ghost/dev/work/elixir-games-projects/elixir/bonding-curve.md`
- **Meteora Studio SDK:** `/Users/ghost/dev/work/meteora-projects/meteora-invent/studio/`
- **Meteora Fun-Launch Scaffold:** `/Users/ghost/dev/work/meteora-projects/meteora-invent/scaffolds/fun-launch/`

## Appendix D: Security Considerations

1. **Never expose platform keypair** to frontend — all automated signing happens server-side
2. **Validate all swap quotes server-side** before presenting to users
3. **Slippage protection** — always enforce `minimumAmountOut` on swaps
4. **Rate limit** quote and trade endpoints to prevent abuse
5. **Simulate transactions** before sending (dry-run mode)
6. **Immutable token metadata** — set `tokenUpdateAuthority: 1` to prevent rug pulls
7. **LP locking** — consider non-zero `creatorLockedLpPercentage` for trust
8. **Input validation** — sanitize all user inputs (symbol length, supply ranges, mcap ranges)
9. **RPC endpoint** — use a dedicated RPC provider (Helius, QuickNode) for production reliability

