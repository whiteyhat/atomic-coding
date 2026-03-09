"use client";

import { useMemo, useCallback } from "react";
import {
  useWallets,
  useCreateWallet,
  useSignAndSendTransaction,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { PublicKey } from "@solana/web3.js";

export function useSolanaWallet() {
  const { wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransaction();
  const { signTransaction: privySign } = useSignTransaction();
  const wallet = wallets[0] ?? null;

  const publicKey = useMemo(() => {
    if (!wallet?.address) return null;
    try {
      return new PublicKey(wallet.address);
    } catch {
      return null;
    }
  }, [wallet?.address]);

  const signAndSendTransaction = useCallback(
    async (tx: Uint8Array): Promise<string> => {
      if (!wallet) throw new Error("No Solana wallet connected");
      const { signature } = await privySignAndSend({
        transaction: tx,
        wallet,
      });
      return Buffer.from(signature).toString("base64");
    },
    [wallet, privySignAndSend],
  );

  const signTransaction = useCallback(
    async (tx: Uint8Array): Promise<Uint8Array> => {
      if (!wallet) throw new Error("No Solana wallet connected");
      const { signedTransaction } = await privySign({
        transaction: tx,
        wallet,
      });
      return signedTransaction;
    },
    [wallet, privySign],
  );

  return {
    wallet,
    publicKey,
    address: wallet?.address ?? null,
    connected: !!wallet?.address,
    signTransaction,
    signAndSendTransaction,
    createWallet,
  };
}
