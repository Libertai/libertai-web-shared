import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { useBillingActions, useTopupPacks } from "../use-payments";

interface TopUpPackPickerProps {
	fiatProviderId: string;
}

/** EUR card top-ups use fixed packs (gross, VAT-inclusive) — picking one starts the hosted checkout. */
export function TopUpPackPicker({ fiatProviderId }: Readonly<TopUpPackPickerProps>) {
	const { data: packs, isLoading } = useTopupPacks();
	const { topup } = useBillingActions();

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
				{[0, 1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-[72px] w-full rounded-md" />
				))}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
			{(packs ?? []).map((pack) => (
				<Button
					key={pack.id}
					variant="outline"
					className="h-auto py-4 flex flex-col items-start gap-1"
					// isSuccess keeps the buttons disabled between mutate resolving and the browser navigating away.
					disabled={topup.isPending || topup.isSuccess}
					onClick={() => topup.mutate({ provider: fiatProviderId, pack_id: pack.id })}
					type="button"
				>
					<span className="font-semibold text-foreground">${pack.usd_credits} credits</span>
					<span className="text-xs text-foreground/70">€{pack.eur_charge} incl. VAT</span>
				</Button>
			))}
		</div>
	);
}
