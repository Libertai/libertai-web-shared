import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../lib/utils";
import { useBillingActions, usePaymentRegion, useTopupPacks } from "../use-payments";

const MIN_USD = 1;
const MAX_USD = 10_000;

interface CardTopUpProps {
	fiatProviderId: string;
	currentBalance: number;
}

/**
 * Single-screen card top-up for walletless (email/OAuth) users: pick an amount, see the total,
 * pay — no payment-method step (card is the only option for these users) and no separate
 * amount-entry stage. The preset amounts come from the backend pack table (useTopupPacks): EU
 * users pick a fixed gross-EUR pack (VAT-inclusive), everyone else picks the same USD value 1:1
 * or enters a custom amount. Paying redirects to the Revolut hosted checkout.
 */
export function CardTopUp({ fiatProviderId, currentBalance }: Readonly<CardTopUpProps>) {
	const { data: region, isLoading: regionLoading } = usePaymentRegion();
	const { data: packs, isLoading: packsLoading } = useTopupPacks();
	const { topup } = useBillingActions();

	const isEur = region?.currency === "EUR";
	// isSuccess keeps the button disabled between mutate resolving and the browser navigating away.
	const busy = topup.isPending || topup.isSuccess;

	const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
	const [isOther, setIsOther] = useState(false);
	const [custom, setCustom] = useState("");

	// Wait for both region and packs so we never flash the wrong layout or empty grid.
	if (regionLoading || packsLoading) {
		return (
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				{[0, 1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-20 w-full rounded-xl" />
				))}
			</div>
		);
	}

	const sortedPacks = [...(packs ?? [])].sort((a, b) => a.usd_credits - b.usd_credits);
	const selectedPack = sortedPacks.find((p) => p.id === selectedPackId) ?? null;

	const customNum = Number(custom);
	const customValid = custom !== "" && Number.isFinite(customNum) && customNum >= MIN_USD && customNum <= MAX_USD;
	// USD-only: the dollar amount to charge (preset credits 1:1, or the custom value).
	const usdAmount = isOther ? (customValid ? Math.round(customNum * 100) / 100 : null) : (selectedPack?.usd_credits ?? null);

	const canPay = isEur ? !!selectedPack : usdAmount != null;
	const payLabel = busy
		? "Redirecting to checkout…"
		: canPay
			? isEur
				? `Pay €${selectedPack!.eur_charge.toFixed(2)}`
				: `Pay $${usdAmount!.toFixed(2)}`
			: isOther
				? "Enter an amount"
				: "Select an amount";

	const onPay = () => {
		if (isEur && selectedPack) topup.mutate({ provider: fiatProviderId, pack_id: selectedPack.id });
		else if (!isEur && usdAmount != null) topup.mutate({ provider: fiatProviderId, amount: usdAmount });
	};

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted-foreground">
				Current balance: <span className="font-semibold text-foreground">${currentBalance.toFixed(2)}</span>
			</p>

			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
				{sortedPacks.map((p) => (
					<AmountCard
						key={p.id}
						selected={!isOther && selectedPackId === p.id}
						onClick={() => {
							setIsOther(false);
							setSelectedPackId(p.id);
						}}
						title={isEur ? `$${p.usd_credits} credits` : `$${p.usd_credits}`}
						subtitle={isEur ? `€${p.eur_charge} incl. VAT` : undefined}
					/>
				))}
				{/* Custom amounts are USD-only — EU sales must use the fixed VAT-inclusive packs. */}
				{!isEur && (
					<AmountCard
						selected={isOther}
						onClick={() => {
							setIsOther(true);
							setSelectedPackId(null);
						}}
						title="Other"
					/>
				)}
			</div>

			{isOther && !isEur && (
				<div className="max-w-xs">
					<div className="relative">
						<span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">$</span>
						<Input
							className="pl-7 h-11"
							inputMode="decimal"
							placeholder="Enter amount"
							value={custom}
							onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))}
							aria-label="Custom amount"
						/>
					</div>
					{custom !== "" && !customValid && (
						<p className="text-xs text-destructive mt-1">Enter an amount between $1 and $10,000</p>
					)}
				</div>
			)}

			{canPay && (
				<Summary
					creditsLabel={`$${(isEur ? selectedPack!.usd_credits : usdAmount!).toFixed(2)}`}
					totalLabel={isEur ? `€${selectedPack!.eur_charge.toFixed(2)}` : `$${usdAmount!.toFixed(2)}`}
					note={isEur ? "VAT included" : undefined}
				/>
			)}

			<Button className="w-full h-12 text-base" disabled={!canPay || busy} onClick={onPay}>
				{payLabel}
			</Button>
		</div>
	);
}

function AmountCard({
	selected,
	onClick,
	title,
	subtitle,
}: Readonly<{ selected: boolean; onClick: () => void; title: string; subtitle?: string }>) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-4 text-center transition-colors",
				selected
					? "border-[2.5px] border-primary bg-primary/5"
					: "border border-border hover:border-primary/50 hover:bg-card/50",
			)}
		>
			<span className="font-semibold text-foreground">{title}</span>
			{subtitle && <span className="text-xs text-foreground/70">{subtitle}</span>}
		</button>
	);
}

function Summary({
	creditsLabel,
	totalLabel,
	note,
}: Readonly<{ creditsLabel: string; totalLabel: string; note?: string }>) {
	return (
		<div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">Usage credits</span>
				<span className="font-medium text-foreground">{creditsLabel}</span>
			</div>
			<div className="flex items-center justify-between border-t border-border pt-3">
				<span className="font-semibold">Total due</span>
				<div className="text-right">
					<div className="text-lg font-bold">{totalLabel}</div>
					{note && <div className="text-xs text-muted-foreground">{note}</div>}
				</div>
			</div>
		</div>
	);
}
