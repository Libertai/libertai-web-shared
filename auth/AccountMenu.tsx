import { ReactNode } from "react";
import { ArrowUpCircle, LogOut, Zap } from "lucide-react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
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
import { useCanUpgrade } from "./use-payments";

type Me = {
	email?: string | null;
	display_name?: string | null;
	avatar_url?: string | null;
	address?: string | null;
} | null;

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
	/** Navigate to the app's plans/billing page. When provided AND the user is below the top tier,
	 *  the menu shows the effective plan under the name, a row upgrade icon, and an "Upgrade plan" item. */
	onUpgrade?: () => void;
};

function formatAddress(address: string) {
	return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Unified account dropdown shared across the LibertAI web apps. Render it in the sidebar footer so the
 * account UI is coherent everywhere. App-specific bits (ENS resolution, navigation, mobile-sidebar
 * close) are passed in as props; the chrome, label resolution, balance and sign-out are handled here.
 */
export function AccountMenu({
	ens,
	items = [],
	onSignIn,
	onSignedOut,
	onAction,
	onUpgrade,
}: Readonly<AccountMenuProps>) {
	const thirdwebAccount = useActiveAccount();
	const evmWallet = useActiveWallet();
	const solanaWallet = useSolanaWallet();
	const { disconnect } = useDisconnect();
	const account = useAccountStore((state) => state.account);
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const me = useAccountStore((state) => state.me) as Me;
	const logout = useAccountStore((state) => state.logout);
	const { loading: planLoading, tier, isFree, canUpgrade } = useCanUpgrade();

	const planLabel = planLoading ? null : isFree ? "Free" : `${tier} plan`;
	const showUpgrade = !!onUpgrade && canUpgrade;
	// On the top tier there's nothing to upgrade to, but the plans page must stay reachable
	// (manage/downgrade/cancel) — show a neutral "Plans" item instead.
	const showPlans = !!onUpgrade && !canUpgrade && !planLoading;
	const handleUpgrade = () => {
		onAction?.();
		onUpgrade?.();
	};

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

	// Identity address: prefer the live connected wallet, else the wallet address from the shared
	// cookie session (`me`). The wallet connection is per-origin (thirdweb stores it per domain) while
	// the session is shared across LibertAI apps — so this keeps the account chip identical everywhere,
	// even on an app where the wallet hasn't been (re)connected.
	const address = account?.address ?? me?.address ?? undefined;
	const isWallet = !!address;
	// Prefer the user's chosen display name everywhere; fall back to ENS/address (wallet) or email.
	const label = isWallet
		? (me?.display_name ?? ens?.displayName ?? ens?.name ?? formatAddress(address!))
		: (me?.display_name ?? me?.email ?? "Account");
	const avatarSrc = isWallet ? ens?.avatar : me?.avatar_url;

	// Secondary identifier for the top of the dropdown. Only meaningful when the button already shows a
	// chosen display name — then we surface the email (or cropped wallet address) underneath for context.
	// Otherwise the button itself is already the email/address, so we show nothing.
	const secondaryId = me?.email ?? (address ? formatAddress(address) : null);
	const showSecondary = !!me?.display_name && !!secondaryId;

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

	return (
		<DropdownMenu>
			{/* Bordered chip holding two sibling buttons (trigger + upgrade icon). They must NOT be
			    nested — a <button> inside a <button> is invalid HTML and breaks hydration. */}
			<div className="flex items-center gap-1 w-full rounded-md border border-border pr-1">
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0 justify-start h-auto"
					>
						<ProfileAvatar src={avatarSrc} address={address} size="md" />
						<div className="flex flex-col items-start flex-1 min-w-0">
							<div className="text-md font-medium truncate w-full text-left">{label}</div>
							{planLabel && (
								<div className="text-xs text-muted-foreground leading-tight truncate w-full text-left capitalize">
									{planLabel}
								</div>
							)}
						</div>
					</Button>
				</DropdownMenuTrigger>
				{showUpgrade && (
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
						aria-label="Upgrade plan"
						title="Upgrade plan"
						onClick={handleUpgrade}
					>
						<ArrowUpCircle className="h-4 w-4" />
					</Button>
				)}
			</div>
			<DropdownMenuContent align="end" className="min-w-[220px]">
				{showSecondary && (
					<div className="px-2 py-1.5">
						<p className="text-sm text-muted-foreground truncate">{secondaryId}</p>
					</div>
				)}

				{showSecondary && <DropdownMenuSeparator />}

				{showUpgrade && (
					<DropdownMenuItem onClick={handleUpgrade} className="cursor-pointer gap-2">
						<ArrowUpCircle className="h-4 w-4" />
						Upgrade plan
					</DropdownMenuItem>
				)}

				{showPlans && (
					<DropdownMenuItem onClick={handleUpgrade} className="cursor-pointer gap-2">
						<Zap className="h-4 w-4" />
						Plans
					</DropdownMenuItem>
				)}

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

				{(items.length > 0 || showUpgrade) && <DropdownMenuSeparator />}

				<DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2">
					<LogOut className="h-4 w-4" />
					Log out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
