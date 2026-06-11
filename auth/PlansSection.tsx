import { useMemo } from "react";
import { Zap } from "lucide-react";
import { Button } from "./ui/button";
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

export function PlansSection() {
	const { data: subscription } = useSubscription();
	const { data: tiers } = useTiers();
	const { data: providers } = usePaymentProviders();
	const { data: regionData } = usePaymentRegion();
	// Default to USD display until the region resolves.
	const region = regionData ?? { currency: "USD", vat_rate: 0 };
	const { subscribe, upgrade, downgrade, cancel } = useBillingActions();

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

	const handleTierAction = (tierName: string) => {
		const provider = isWallet ? "credits" : (fiatProvider?.id ?? "revolut");
		const target = tierOrder[tierName] ?? 0;
		const current = tierOrder[currentTier] ?? 0;
		if (tierName === "free") {
			downgrade.mutate({ tier: "free" });
		} else if (target > current) {
			(hasActivePaidSub ? upgrade : subscribe).mutate({ provider, tier: tierName });
		} else if (target < current) {
			downgrade.mutate({ tier: tierName });
		}
	};

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
					(subscription?.cancel_at_period_end ? (
						<span className="text-sm text-muted-foreground">Cancels at period end</span>
					) : (
						<Button variant="outline" size="sm" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
							Cancel subscription
						</Button>
					))}
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{(tiers ?? []).map((tier) => {
					const isCurrent = tier.name === currentTier;
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
								variant={isCurrent ? "outline" : "default"}
								disabled={isCurrent || (tier.is_paid && !isWallet && !fiatProvider)}
								onClick={() => handleTierAction(tier.name)}
							>
								{isCurrent
									? "Current plan"
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
		</div>
	);
}
