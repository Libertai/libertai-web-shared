import { arbitrum, avalanche, base, bsc, ethereum, linea, optimism, polygon } from "thirdweb/chains";

/** Chains requested in the WalletConnect session at connect time.
 *
 * Payments settle on Base, but the crypto checkout bridges from wherever the funds already are, and
 * that first transaction goes out on the source chain. A WalletConnect session only carries the
 * namespaces asked for when it was opened — request Base alone and a bridge from any other chain
 * fails with "Please call connect() before request()", since the provider has no session for it.
 * A session already open keeps its original namespaces: widening this list only affects wallets
 * that reconnect afterwards.
 */
export const WALLET_CHAINS = [base, ethereum, arbitrum, optimism, polygon, bsc, linea, avalanche];
