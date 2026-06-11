import { useMemo, useState } from "react";
import { Zap } from "lucide-react";
import { Button } from "./ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./ui/dialog";
import { useBillingActions, usePaymentProviders, usePaymentRegion, useSubscription, useTiers } from "./use-payments";
import { useAccountStore } from "./account";

// Qualitative descriptions — we deliberately don't surface raw allowance numbers.
const TIER_TAGLINES: Record<string, string> = {
	free: "For getting started and light use",
	go: "For regular individual use",
	plus: "For heavy, daily workloads",
	max: "Maximum limits for power users",
};

const CURRENCY_SYMBOL: Record<string, string> = { USD: "$", EUR: "€" };

/** Money moves (upgrade) or entitlement shrinks (downgrade/cancel) — every one of these
 * is confirmed in a dialog before acting. */
type ConfirmAction = { kind: "upgrade" | "downgrade" | "cancel"; tier?: string };

export function PlansSection() {
	const { data: subscription } = useSubscription();
	const { data: tiers } = useTiers();
	const { data: providers } = usePaymentProviders();
	const { data: regionData } = usePaymentRegion();
	// Default to USD display until the region resolves.
	const region = regionData ?? { currency: "USD", vat_rate: 0 };
	const { subscribe, upgrade, downgrade, cancel, resume } = useBillingActions();

	const account = useAccountStore((s) => s.account);
	const isWallet = !!account;
	const fiatProvider = useMemo(() => providers?.find((p) => p.kind === "fiat"), [providers]);
	const tierOrder = useMemo(() => {
		const map: Record<string, number> = {};
		(tiers ?? []).forEach((t, i) => (map[t.name] = i));
		return map;
	}, [tiers]);

	const currentTier = subscription?.tier ?? "free";
	const hasActivePaidSub =
		!!subscription?.has_subscription && subscription?.status === "active" && currentTier !== "free";
	// A requested downgrade/cancel is SCHEDULED: the current tier stays active until period
	// end, with the target recorded in pending_tier ("free" for a cancellation). Until then
	// it can be resumed.
	const pendingTier = subscription?.pending_tier ?? null;
	const cancelScheduled = !!subscription?.cancel_at_period_end;
	const hasScheduledChange = !!pendingTier || cancelScheduled;
	// "at period end" is meaningless without the date — show it when we have it (e.g. "on Jun 28").
	const periodEnd = subscription?.current_period_end
		? `on ${new Date(subscription.current_period_end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
		: "at period end";

	const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

	const handleTierAction = (tierName: string) => {
		const provider = isWallet ? "credits" : (fiatProvider?.id ?? "revolut");
		const target = tierOrder[tierName] ?? 0;
		const current = tierOrder[currentTier] ?? 0;
		if (tierName === "free") {
			setConfirm({ kind: "downgrade", tier: "free" });
		} else if (target > current) {
			if (hasActivePaidSub) {
				setConfirm({ kind: "upgrade", tier: tierName });
			} else {
				subscribe.mutate({ provider, tier: tierName });
			}
		} else if (target < current) {
			setConfirm({ kind: "downgrade", tier: tierName });
		}
	};

	const runConfirmed = () => {
		if (!confirm) return;
		const provider = isWallet ? "credits" : (fiatProvider?.id ?? "revolut");
		if (confirm.kind === "upgrade" && confirm.tier) {
			upgrade.mutate({ provider, tier: confirm.tier });
		} else if (confirm.kind === "downgrade" && confirm.tier) {
			downgrade.mutate({ tier: confirm.tier });
		} else if (confirm.kind === "cancel") {
			cancel.mutate();
		}
		setConfirm(null);
	};

	// Rough refund preview for fiat upgrades: days left on the current cycle x its monthly price.
	const upgradeRefundEstimate = useMemo(() => {
		const currentPrice = (tiers ?? []).find((t) => t.name === currentTier)?.price_cents ?? 0;
		const end = subscription?.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
		if (!end || currentPrice <= 0) return null;
		const fraction = Math.min(Math.max((end - Date.now()) / (30 * 24 * 3600 * 1000), 0), 1);
		return (currentPrice / 100) * fraction;
	}, [tiers, currentTier, subscription?.current_period_end]);

	const isEndingToFree = confirm?.kind === "cancel" || (confirm?.kind === "downgrade" && confirm.tier === "free");
	const confirmTitle =
		confirm?.kind === "upgrade" ? (
			<>
				Upgrade to <span className="capitalize">{confirm.tier}</span>?
			</>
		) : isEndingToFree ? (
			<>Cancel your subscription?</>
		) : (
			<>
				Switch to <span className="capitalize">{confirm?.tier}</span>?
			</>
		);

	return (
		<div className="flex flex-col space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div className="flex items-center gap-3">
					<Zap className="h-5 w-5 text-primary" />
					<h2 className="text-xl font-semibold">
						Plan: <span className="capitalize text-primary">{currentTier}</span>
					</h2>
				</div>
				{hasActivePaidSub &&
					(hasScheduledChange ? (
						<div className="flex items-center gap-3">
							<span className="text-sm text-muted-foreground">
								{pendingTier && pendingTier !== "free" ? (
									<>
										Switches to <span className="capitalize">{pendingTier}</span> {periodEnd}
									</>
								) : (
									<>Cancels {periodEnd}</>
								)}
							</span>
							<Button variant="outline" size="sm" onClick={() => resume.mutate()} disabled={resume.isPending}>
								{pendingTier && pendingTier !== "free" ? (
									<>
										Keep <span className="capitalize">{currentTier}</span>
									</>
								) : (
									"Resume subscription"
								)}
							</Button>
						</div>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setConfirm({ kind: "cancel" })}
							disabled={cancel.isPending}
						>
							Cancel subscription
						</Button>
					))}
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{(tiers ?? []).map((tier) => {
					const isCurrent = tier.name === currentTier;
					// The free card mirrors a scheduled cancellation too (cancel == downgrade to free).
					const isScheduled =
						tier.name === pendingTier || (tier.name === "free" && cancelScheduled && hasActivePaidSub);
					// Tier data always carries currency "USD" — the user's region decides the display
					// currency. EUR plans are net-priced with the SAME number as USD by design (Revolut
					// adds VAT on top), so we only swap the symbol and append the VAT note.
					const symbol = CURRENCY_SYMBOL[region.currency] ?? "$";
					return (
						<div
							key={tier.name}
							className={`p-6 rounded-xl border ${isCurrent ? "border-primary" : "border-border"} bg-card/50 flex flex-col`}
						>
							<h3 className="text-lg font-semibold capitalize">{tier.name}</h3>
							<p className="text-2xl font-bold mt-2">
								{tier.price_cents === 0 ? "Free" : `${symbol}${(tier.price_cents / 100).toFixed(0)}`}
								{tier.price_cents > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
								{tier.price_cents > 0 && region.currency === "EUR" && (
									<span className="text-xs font-normal text-muted-foreground ml-1.5">
										+ {Math.round(region.vat_rate * 100)}% VAT
									</span>
								)}
							</p>
							<p className="mt-4 text-sm text-muted-foreground flex-1">{TIER_TAGLINES[tier.name] ?? ""}</p>
							<Button
								className="mt-4 w-full"
								variant={isCurrent || isScheduled ? "outline" : "default"}
								disabled={
									isCurrent || isScheduled || downgrade.isPending || (tier.is_paid && !isWallet && !fiatProvider)
								}
								onClick={() => handleTierAction(tier.name)}
							>
								{isCurrent
									? "Current plan"
									: isScheduled
										? "Scheduled at period end"
										: (tierOrder[tier.name] ?? 0) > (tierOrder[currentTier] ?? 0)
											? "Upgrade"
											: "Downgrade"}
							</Button>
						</div>
					);
				})}
			</div>
			{!isWallet && !fiatProvider && (
				<p className="text-xs text-muted-foreground">Paid plans become available once card payments are configured.</p>
			)}

			{/* Confirmation before money moves (upgrade) or entitlement shrinks (downgrade/cancel). */}
			<Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{confirmTitle}</DialogTitle>
						<DialogDescription className="space-y-2 pt-1">
							{confirm?.kind === "upgrade" ? (
								isWallet ? (
									<span>
										You'll be charged the prorated difference for the rest of your current billing period from your
										credits, and your plan switches immediately.
									</span>
								) : (
									<span>
										Your new plan starts now with a fresh monthly cycle, billed at full price. The unused time left
										on your <span className="capitalize">{currentTier}</span> plan
										{upgradeRefundEstimate != null && <> (≈ ${upgradeRefundEstimate.toFixed(2)})</>} is refunded to
										your usage credits.
									</span>
								)
							) : isEndingToFree ? (
								<span>
									You keep <span className="capitalize">{currentTier}</span> until {periodEnd.replace(/^on /, "")},
									then your subscription ends and you drop to the Free plan. You can resume anytime before then.
								</span>
							) : (
								<span>
									You keep <span className="capitalize">{currentTier}</span> until {periodEnd.replace(/^on /, "")};
									the next cycle bills at the <span className="capitalize">{confirm?.tier}</span> price. You can undo
									this until the period ends.
								</span>
							)}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirm(null)}>
							Back
						</Button>
						<Button
							variant={confirm?.kind === "upgrade" ? "default" : "destructive"}
							onClick={runConfirmed}
							disabled={upgrade.isPending || downgrade.isPending || cancel.isPending}
						>
							{confirm?.kind === "upgrade"
								? isWallet
									? "Confirm upgrade"
									: "Continue to payment"
								: isEndingToFree
									? "Cancel subscription"
									: "Confirm switch"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
