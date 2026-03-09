import { Connection } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "../constants";

let _connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(SOLANA_RPC_URL, "confirmed");
  }
  return _connection;
}
