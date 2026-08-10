import { useEffect } from "react";
import { ConnectButton, useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton as SolanaWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { libertaiConfig } from "./config";
import { useAccountStore } from "./account";

/**
 * Invisible, always-mounted bridge between the connected wallet and the account store
 * (auto-reconnect + signature-based authentication). Rendered by <LibertaiProviders /> —
 * without it a wallet connects but is never asked to sign, so apps must not mount it twice.
 */
export default function WalletSync() {
	const thirdwebAccount = useActiveAccount();
	const evmWallet = useActiveWallet();
	const solanaWallet = useSolanaWallet();
	const onAccountChange = useAccountStore((state) => state.onAccountChange);
	const staleWalletConnection = useAccountStore((state) => state.staleWalletConnection);
	const clearStaleWalletConnection = useAccountStore((state) => state.clearStaleWalletConnection);
	const { disconnect } = useDisconnect();
	const thirdwebClient = libertaiConfig().thirdwebClient;

	useEffect(() => {
		onAccountChange(thirdwebAccount, solanaWallet).then();
	}, [thirdwebAccount, solanaWallet, onAccountChange, evmWallet]);

	// Drop a wallet that failed to sign because it can't answer requests. Disconnecting also clears
	// thirdweb's stored connection, so the next page load starts clean instead of auto-reconnecting
	// the same dead session and failing again.
	useEffect(() => {
		if (!staleWalletConnection) return;
		clearStaleWalletConnection();
		if (evmWallet) disconnect(evmWallet);
		if (solanaWallet.connected) void solanaWallet.disconnect();
	}, [staleWalletConnection, clearStaleWalletConnection, disconnect, evmWallet, solanaWallet]);

	// Subscribe to in-wallet EVM account switches once per wallet (in an effect, with
	// cleanup) — doing it during render would register a new listener every render.
	useEffect(() => {
		if (!evmWallet) return;
		const unsubscribe = evmWallet.subscribe("accountChanged", (newAccount) => {
			onAccountChange(newAccount, solanaWallet).then();
		});
		return () => unsubscribe();
	}, [evmWallet, solanaWallet, onAccountChange]);

	return (
		<div className="absolute invisible opacity-0 pointer-events-none -z-10">
			<ConnectButton client={thirdwebClient} chain={base} />
			<SolanaWalletMultiButton />
		</div>
	);
}
