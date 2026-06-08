import { ReactNode } from "react";
import { Coins, Copy, Loader2, LogOut } from "lucide-react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ProfileAvatar } from "./ProfileAvatar";
import { useAccountStore } from "./account";

type Me = { email?: string | null; display_name?: string | null; avatar_url?: string | null; address?: string | null } | null;

export type AccountMenuItem = {
	label: string;
	icon?: ReactNode;
	onSelect: () => void;
	destructive?: boolean;
};

export type AccountMenuProps = {
	/** ENS data for the connected wallet. Apps own the thirdweb client, so they resolve and pass it in. */
	ens?: { name?: string | null; displayName?: string | null; avatar?: string | null };
	/** App-specific items shown between the account header and Sign out (e.g. a Settings link). */
	items?: AccountMenuItem[];
	/** Navigate to the app's sign-in page when no session exists (renders a "Sign in" button). */
	onSignIn?: () => void;
	/** Called after a successful sign out (e.g. navigate home). */
	onSignedOut?: () => void;
	/** Called whenever any item / sign-in / sign-out is activated (e.g. close the mobile sidebar). */
	onAction?: () => void;
};

function formatAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Unified account dropdown shared across the LibertAI web apps. Render it in the sidebar footer so the
 * account UI is coherent everywhere. App-specific bits (ENS resolution, navigation, mobile-sidebar
 * close) are passed in as props; the chrome, label resolution, balance and sign-out are handled here.
 */
export function AccountMenu({ ens, items = [], onSignIn, onSignedOut, onAction }: Readonly<AccountMenuProps>) {
	const thirdwebAccount = useActiveAccount();
	const evmWallet = useActiveWallet();
	const solanaWallet = useSolanaWallet();
	const { disconnect } = useDisconnect();
	const account = useAccountStore((state) => state.account);
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const me = useAccountStore((state) => state.me) as Me;
	const logout = useAccountStore((state) => state.logout);
	const formattedLtaiBalance = useAccountStore((state) => state.formattedLTAIBalance());
	const isAuthenticating = useAccountStore((state) => state.isAuthenticating);

	// No session and no connected wallet → offer sign-in (or nothing if the app didn't provide a handler).
	if (!account?.address && !isAuthenticated) {
		if (!onSignIn) return null;
		return (
			<Button
				variant="outline"
				className="w-full justify-center"
				onClick={() => {
					onAction?.();
					onSignIn();
				}}
			>
				Sign in
			</Button>
		);
	}

	const isWallet = !!account?.address;
	// Prefer the user's chosen display name everywhere; fall back to ENS/address (wallet) or email.
	const label = isWallet
		? (me?.display_name ?? ens?.displayName ?? ens?.name ?? formatAddress(account!.address))
		: (me?.display_name ?? me?.email ?? "Account");
	const avatarSrc = isWallet ? ens?.avatar : me?.avatar_url;

	const shouldShowWalletLoading =
		isAuthenticating && (!!(thirdwebAccount && evmWallet) || !!solanaWallet.wallet);

	const handleSignOut = async () => {
		onAction?.();
		// Cookie-based: end the server session, then drop any connected wallet.
		await logout();
		if (thirdwebAccount !== undefined && evmWallet !== undefined) {
			disconnect(evmWallet);
		} else if (solanaWallet.wallet !== null) {
			await solanaWallet.disconnect();
		}
		onSignedOut?.();
	};

	const copyAddress = () => {
		if (!account?.address) return;
		navigator.clipboard.writeText(account.address);
		toast.success("Address copied");
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className="flex items-center gap-3 px-3 py-2 border-border w-full justify-start h-auto"
				>
					<ProfileAvatar src={avatarSrc} address={account?.address} size="md" />
					<div className="flex flex-col items-start flex-1 min-w-0">
						<div className="text-md font-medium truncate w-full text-left">{label}</div>
					</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-[220px]">
				<div className="px-2 py-2">
					<p className="text-xs text-muted-foreground">{isWallet ? "Connected as" : "Signed in as"}</p>
					<div className="flex items-center gap-2">
						<ProfileAvatar src={avatarSrc} address={account?.address} size="sm" />
						<div className="flex-1 min-w-0">
							<p className="font-medium truncate text-sm">{label}</p>
						</div>
						{isWallet && (
							<Button
								variant="ghost"
								size="sm"
								onClick={copyAddress}
								className="h-6 w-6 p-0 hover:bg-muted flex-shrink-0"
							>
								<Copy className="h-3 w-3" />
							</Button>
						)}
					</div>
				</div>

				{isWallet && (
					<div className="px-2 py-2">
						<p className="text-xs text-muted-foreground">Balance</p>
						<p className="font-medium flex items-center">
							{shouldShowWalletLoading ? (
								<>
									<Loader2 className="h-3 w-3 mr-1 animate-spin" />
									Loading...
								</>
							) : (
								<>
									<Coins className="h-3 w-3 mr-1 text-primary" />
									{formattedLtaiBalance} LTAI
								</>
							)}
						</p>
					</div>
				)}

				<DropdownMenuSeparator />

				{items.map((item) => (
					<DropdownMenuItem
						key={item.label}
						onClick={() => {
							onAction?.();
							item.onSelect();
						}}
						className="cursor-pointer gap-2"
						variant={item.destructive ? "destructive" : "default"}
					>
						{item.icon}
						{item.label}
					</DropdownMenuItem>
				))}

				<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2 text-destructive">
					<LogOut className="h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
