import { create } from "zustand";
import { Account as ThirdwebAccount } from "thirdweb/wallets";
import { base } from "thirdweb/chains";
import {
	checkAuthStatusAuthStatusGet,
	exchangeCodeAuthExchangePost,
	getAuthMessageAuthMessagePost,
	getMeAuthMeGet,
	loginEmailAuthLoginEmailPost,
	loginWithWalletAuthLoginPost,
	logoutAuthLogoutPost,
	updateMeAuthMePatch,
	verifyMagicLinkRouteAuthVerifyMagicLinkPost,
} from "../inference-sdk";
import { toast } from "sonner";
import { ethers } from "ethers";
import { WalletContextState as SolanaWalletContextState } from "@solana/wallet-adapter-react";
import { Buffer } from "buffer";
import { QueryClient } from "@tanstack/react-query";
import { libertaiConfig } from "./config";

type ConnectedAccount = {
	address: string;
} & (
	| {
			chain: "base";
			provider: ThirdwebAccount;
	  }
	| {
			chain: "solana";
			provider: SolanaWalletContextState;
	  }
);

type AccountStoreState = {
	ltaiBalance: number;
	solBalance: number;
	formattedLTAIBalance: () => string;
	formattedSOLBalance: () => string;
	account: ConnectedAccount | null;
	isAuthenticated: boolean;
	isAuthenticating: boolean;
	// The authenticated user's profile from /auth/me (cookie-based session). Null until checkSession() succeeds.
	me: unknown | null;
	loginWithEmail: (email: string) => Promise<boolean>;
	verifyEmailCode: (email: string, code: string) => Promise<boolean>;
	verifyMagicLinkToken: (token: string) => Promise<boolean>;
	loginWithOAuth: (provider: "google" | "github") => void;
	exchangeOAuthCode: (code: string) => Promise<boolean>;
	// Update the editable profile (display name). Refreshes `me` on success.
	updateProfile: (displayName: string | null) => Promise<boolean>;
	logout: () => Promise<void>;
	// Cookie-based session probe: call on app startup to hydrate isAuthenticated / me.
	checkSession: () => Promise<boolean>;
	lastTransactionHash: string | null;
	isInitialLoad: boolean;
	queryClient: QueryClient | null;
	setQueryClient: (client: QueryClient) => void;
	onAccountChange: (
		newBaseAccount: ThirdwebAccount | undefined,
		newSolanaAccount: SolanaWalletContextState | undefined,
	) => Promise<void>;
	getLTAIBalance: () => Promise<number>;
	getSOLBalance: () => Promise<number>;
	onDisconnect: () => void;
	authenticate: (
		baseAccount: ThirdwebAccount | undefined,
		solanaAccount: SolanaWalletContextState | undefined,
		showErrors?: boolean,
	) => Promise<boolean>;
	checkAuthStatus: (accountAddress: string) => Promise<boolean>;
	setLastTransactionHash: (hash: string | null) => void;
	setInitialLoadComplete: () => void;
};

// Monotonic auth epoch. Bumped on every interactive login/logout so a slow
// startup checkSession() (whose /auth/me went out before the cookie existed and
// returns 401) can't clobber a session that was established while it was in flight.
let authEpoch = 0;

export const useAccountStore = create<AccountStoreState>((set, get) => ({
	ltaiBalance: 0,
	solBalance: 0,
	formattedLTAIBalance: () => get().ltaiBalance.toFixed(0),
	formattedSOLBalance: () => get().solBalance.toFixed(0),
	isAuthenticated: false,
	isAuthenticating: false,
	me: null,
	lastTransactionHash: null,
	isInitialLoad: true,
	account: null,
	queryClient: null,

	setQueryClient: (client: QueryClient) => {
		set({ queryClient: client });
	},

	onAccountChange: async (
		newBaseAccount: ThirdwebAccount | undefined,
		newSolanaAccount: SolanaWalletContextState | undefined,
	) => {
		const state = get();

		// Check if both accounts are undefined/null - this indicates disconnection
		if (newBaseAccount === undefined && (newSolanaAccount === undefined || !newSolanaAccount.publicKey)) {
			// Potential disconnection
			state.onDisconnect();
			return;
		}

		// Check if a Base account is already connected with the same address
		if (state.account !== null && newBaseAccount !== undefined && state.account.address === newBaseAccount.address) {
			// Base account already connected with the same address
			return;
		}

		// Check if a Solana account is already connected with the same address
		if (
			state.account !== null &&
			newSolanaAccount?.publicKey &&
			state.account.address === newSolanaAccount.publicKey.toString()
		) {
			// Solana account already connected with the same address
			return;
		}

		if (state.isAuthenticating) {
			// Prevent multiple simultaneous authentication attempts
			return;
		}

		// Set the account first so UI shows connected state
		if (newBaseAccount !== undefined) {
			set({
				account: { address: newBaseAccount.address, chain: "base", provider: newBaseAccount },
			});
		} else if (newSolanaAccount?.publicKey) {
			set({
				account: { address: newSolanaAccount.publicKey.toString(), chain: "solana", provider: newSolanaAccount },
			});
		}

		// First check if we're already authenticated with this wallet
		set({ isAuthenticating: true });

		try {
			const address = newSolanaAccount?.publicKey?.toString() ?? newBaseAccount?.address ?? "";
			const isAlreadyAuthenticated = await state.checkAuthStatus(address);

			let authSuccess = isAlreadyAuthenticated;
			if (!isAlreadyAuthenticated) {
				// Only try to authenticate if this isn't an initial page load reconnection
				// or if user manually clicked connect
				const shouldShowErrors = !state.isInitialLoad;
				authSuccess = await state.authenticate(newBaseAccount, newSolanaAccount, shouldShowErrors);
			}

			if (authSuccess) {
				authEpoch++; // protect this wallet session from a stale in-flight checkSession
			}
			set({
				isAuthenticating: false,
				isAuthenticated: authSuccess,
				isInitialLoad: false,
			});

			if (authSuccess) {
				// Load the profile (display name, avatar) so the account chip isn't stuck on the address.
				await state.checkSession();

				// Invalidate all queries to refetch with new account
				if (state.queryClient) {
					state.queryClient.invalidateQueries();
				}

				// Get LTAI token balance from blockchain
				const ltaiBalance = await state.getLTAIBalance();
				set({ ltaiBalance: ltaiBalance });
				if (newSolanaAccount?.publicKey) {
					const solBalance = await state.getSOLBalance();
					set({ solBalance: solBalance });
				}
			}
		} catch (error) {
			console.error("Account change error:", error);
			set({
				isAuthenticating: false,
				isAuthenticated: false,
			});
		} finally {
			// Mark initial load as complete no matter what
			if (state.isInitialLoad) {
				set({ isInitialLoad: false });
			}
		}
	},
	getLTAIBalance: async (): Promise<number> => {
		const state = get();
		let balance: string = "0";

		if (state.account === null) {
			return 0;
		}

		if (state.account.chain === "base") {
			const address = state.account.address.startsWith("0x") ? state.account.address.slice(2) : state.account.address;
			const paddedAddress = address.padStart(64, "0");
			const hexBalanceOfFunction = "0x70a08231";
			const body = {
				jsonrpc: "2.0",
				method: "eth_call",
				params: [
					{
						to: libertaiConfig().ltaiBaseAddress,
						data: `${hexBalanceOfFunction}${paddedAddress}`,
					},
					"latest",
				],
				id: base.id,
			};

			try {
				const response = await fetch("https://mainnet.base.org", {
					method: "POST",
					body: JSON.stringify(body),
					headers: {
						"Content-Type": "application/json",
					},
				});

				const json = await response.json();
				const weiBalance = ethers.getBigInt(json.result);
				balance = ethers.formatEther(weiBalance);
			} catch (error) {
				console.error("Error fetching balance:", error);
			}
		} else if (state.account.chain === "solana") {
			try {
				const body = {
					jsonrpc: "2.0",
					id: 1,
					method: "getTokenAccountsByOwner",
					params: [
						state.account.address,
						{
							mint: libertaiConfig().ltaiSolanaAddress,
						},
						{
							encoding: "jsonParsed",
						},
					],
				};

				const response = await fetch(libertaiConfig().solanaRpc, {
					method: "POST",
					body: JSON.stringify(body),
					headers: {
						"Content-Type": "application/json",
					},
				});
				const json = await response.json();
				let ltaiBalance = 0.0;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				json.result.value.forEach((value: any) => {
					ltaiBalance += value.account.data.parsed.info.tokenAmount.uiAmount;
				});
				balance = String(ltaiBalance);
			} catch (error) {
				console.error("Error fetching Solana balance:", error);
			}
		}
		return Number(balance);
	},
	getSOLBalance: async (): Promise<number> => {
		const state = get();
		let balance: string = "0";

		if (state.account === null) {
			return 0;
		}

		try {
			const body = {
				jsonrpc: "2.0",
				id: 1,
				method: "getBalance",
				params: [
					state.account.address,
					{
						encoding: "jsonParsed",
					},
				],
			};

			const response = await fetch(libertaiConfig().solanaRpc, {
				method: "POST",
				body: JSON.stringify(body),
				headers: {
					"Content-Type": "application/json",
				},
			});
			const json = await response.json();
			if (json.result && json.result.value) {
				balance = String(json.result.value / 1e9);
			}
		} catch (error) {
			console.error("Error fetching Solana balance:", error);
		}
		return Number(balance);
	},
	loginWithEmail: async (email: string): Promise<boolean> => {
		// Send our origin so the magic-link email points back to this app (chat vs console),
		// not a single hardcoded frontend. Backend validates it against an allowlist.
		const redirect_base = typeof window !== "undefined" ? window.location.origin : undefined;
		const response = await loginEmailAuthLoginEmailPost({ body: { email, redirect_base } });
		if (response.error) {
			toast.error("Could not send the sign-in email");
			return false;
		}
		return true;
	},
	verifyEmailCode: async (email: string, code: string): Promise<boolean> => {
		// Cookie-based: the backend sets the httpOnly session cookie on success. No tokens stored client-side.
		const response = await verifyMagicLinkRouteAuthVerifyMagicLinkPost({ body: { email, code } });
		if (response.error) {
			toast.error("Invalid or expired code");
			return false;
		}
		authEpoch++;
		set({ isAuthenticated: true, isInitialLoad: false });
		await get().checkSession(); // populate `me` (email/profile) from /auth/me
		get().queryClient?.invalidateQueries();
		return true;
	},
	verifyMagicLinkToken: async (token: string): Promise<boolean> => {
		const response = await verifyMagicLinkRouteAuthVerifyMagicLinkPost({ body: { token } });
		if (response.error) {
			return false;
		}
		authEpoch++;
		set({ isAuthenticated: true, isInitialLoad: false });
		await get().checkSession();
		get().queryClient?.invalidateQueries();
		return true;
	},
	loginWithOAuth: (provider: "google" | "github") => {
		// Full-page redirect to the backend, which redirects to the provider then back to /auth/callback.
		// Pass our origin as redirect_base so the backend returns the user to THIS app (chat vs console)
		// after the provider round-trip — validated against an allowlist server-side. Without it, OAuth
		// always lands on the single hardcoded FRONTEND_URL regardless of where the user started.
		const base = libertaiConfig().apiBaseUrl;
		const redirectBase = typeof window !== "undefined" ? window.location.origin : undefined;
		window.location.href = redirectBase
			? `${base}/auth/oauth/${provider}?redirect_base=${encodeURIComponent(redirectBase)}`
			: `${base}/auth/oauth/${provider}`;
	},
	exchangeOAuthCode: async (code: string): Promise<boolean> => {
		const response = await exchangeCodeAuthExchangePost({ body: { code } });
		if (response.error) {
			return false;
		}
		authEpoch++;
		set({ isAuthenticated: true, isInitialLoad: false });
		await get().checkSession();
		get().queryClient?.invalidateQueries();
		return true;
	},
	updateProfile: async (displayName: string | null): Promise<boolean> => {
		const response = await updateMeAuthMePatch({ body: { display_name: displayName } });
		if (response.error) {
			toast.error("Could not update your profile");
			return false;
		}
		set({ me: response.data ?? null });
		get().queryClient?.invalidateQueries();
		return true;
	},
	logout: async (): Promise<void> => {
		// Best-effort: clear the server session cookie. Errors are non-fatal (we still clear local state).
		// The cookie-based backend ignores the body; cast since the generated type still expects a refresh_token.
		authEpoch++;
		try {
			await logoutAuthLogoutPost({ body: {} as never });
		} catch {
			// best-effort
		}
		set({ isAuthenticated: false, account: null, me: null, isInitialLoad: false });
		// Drop cached data so the next user doesn't see the previous session's data.
		get().queryClient?.clear();
	},
	checkSession: async (): Promise<boolean> => {
		const epochAtStart = authEpoch;
		try {
			const response = await getMeAuthMeGet();
			// A login/logout happened while /auth/me was in flight → our result is stale; don't clobber it.
			if (authEpoch !== epochAtStart) {
				set({ isInitialLoad: false });
				return get().isAuthenticated;
			}
			const authenticated = !response.error;
			set({ isAuthenticated: authenticated, me: response.data ?? null, isInitialLoad: false });
			return authenticated;
		} catch (error) {
			console.error("Session check error:", error);
			if (authEpoch !== epochAtStart) {
				set({ isInitialLoad: false });
				return get().isAuthenticated;
			}
			set({ isAuthenticated: false, me: null, isInitialLoad: false });
			return false;
		}
	},
	checkAuthStatus: async (accountAddress: string): Promise<boolean> => {
		try {
			const response = await checkAuthStatusAuthStatusGet();
			// Wallets hand back EIP-55 checksummed addresses; the backend stores them lowercased.
			// A case-sensitive match never holds, and a miss re-prompts the wallet to sign.
			const sessionAddress = response.data?.address?.toLowerCase();
			return !!(response.data?.authenticated && sessionAddress === accountAddress.toLowerCase());
		} catch (error) {
			console.error("Auth status check error:", error);
			return false;
		}
	},
	authenticate: async (
		baseAccount: ThirdwebAccount | undefined,
		solanaAccount: SolanaWalletContextState | undefined,
		showErrors?: boolean,
	): Promise<boolean> => {
		let address: string;
		let chain: "base" | "solana";
		if (baseAccount !== undefined) {
			address = baseAccount.address;
			chain = "base";
		} else if (solanaAccount?.publicKey) {
			address = solanaAccount.publicKey.toString();
			chain = "solana";
		} else {
			console.error("No account provided for authentication");
			if (showErrors) {
				toast.error("Authentication failed", {
					description: "No wallet connected",
				});
			}
			return false;
		}

		try {
			// Get the message to sign
			const messageResponse = await getAuthMessageAuthMessagePost({
				body: {
					chain: chain,
					address: address,
				},
			});

			if (!messageResponse.data?.message) {
				console.error("No message received from server");
				if (showErrors) {
					toast.error("Authentication failed", {
						description: "Could not get message to sign",
					});
				}
				return false;
			}

			// Sign the message
			let signature: string | undefined;
			if (chain === "base" && baseAccount !== undefined) {
				signature = await baseAccount.signMessage({ message: messageResponse.data.message });
			} else if (chain === "solana" && solanaAccount?.signMessage !== undefined) {
				const messageBytes = new TextEncoder().encode(messageResponse.data.message);
				const raw_signature = await solanaAccount.signMessage(messageBytes);

				if (!raw_signature) {
					console.error("No signature generated");
					if (showErrors) {
						toast.error("Authentication failed", {
							description: "Could not sign message",
						});
					}
					return false;
				}

				// Convert signature to base64 for Solana
				signature = Buffer.from(raw_signature).toString("base64");
			}

			if (!signature) {
				console.error("No signature generated");
				if (showErrors) {
					toast.error("Authentication failed", {
						description: "Could not sign message",
					});
				}
				return false;
			}

			// Login with the signature. On success the backend sets the session cookie (no tokens stored client-side).
			const loginResponse = await loginWithWalletAuthLoginPost({
				body: {
					address: address,
					signature: signature,
					chain: chain,
				},
			});

			if (!loginResponse.error) {
				set({ isAuthenticated: true });
				get().queryClient?.invalidateQueries();

				return true;
			} else {
				console.error("Wallet login failed");
				if (showErrors) {
					toast.error("Authentication failed", {
						description: "Invalid response from server",
					});
				}
				return false;
			}
		} catch (error) {
			console.error("Authentication error:", error);

			// Only show toast if we should show errors
			if (showErrors) {
				toast.error("Authentication failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
			return false;
		}
	},
	onDisconnect: () => {
		// The session is cookie-based and independent of the connected wallet, so a wallet
		// disconnect must NOT touch isAuthenticated (only logout() / checkSession() do).
		// It just clears wallet-derived state. This also prevents WalletSync's initial
		// onAccountChange(undefined, undefined) from bouncing a fresh email/OAuth login.
		set({
			ltaiBalance: 0,
			solBalance: 0,
			lastTransactionHash: null,
			account: null,
		});
	},

	setLastTransactionHash: (hash: string | null) => {
		set({ lastTransactionHash: hash });
	},

	setInitialLoadComplete: () => {
		set({ isInitialLoad: false });
	},
}));
