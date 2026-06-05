import { ReactNode, useMemo } from "react";
import { ThirdwebProvider } from "thirdweb/react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { libertaiConfig } from "./config";

/**
 * Shared wallet provider stack for LibertAI web apps. Wrap your app root with this
 * (inside your QueryClientProvider) instead of duplicating the thirdweb + Solana setup.
 *
 * Reads `solanaRpc` (and indirectly `thirdwebClientId`) from `libertaiConfig()`, so
 * `initLibertaiAuth(...)` must be called before this renders.
 *
 * NOTE: this does NOT set up react-query. Apps own their QueryClient and should call
 * `useAccountStore.getState().setQueryClient(client)` so the store can invalidate/clear it.
 */
export function LibertaiProviders({ children }: { children: ReactNode }) {
	const endpoint = useMemo(() => libertaiConfig().solanaRpc, []);

	return (
		<ConnectionProvider endpoint={endpoint}>
			<WalletProvider wallets={[]} autoConnect>
				<WalletModalProvider>
					<ThirdwebProvider>{children}</ThirdwebProvider>
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	);
}
