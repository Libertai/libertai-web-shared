import { Button } from "../ui/button";
import { useCanUpgrade } from "../use-payments";

interface UsageCreditsCardProps {
	balance: number;
	description: string;
	// Optional: pages that already render the plan cards (e.g. console billing) omit this so the
	// redundant "Upgrade plan" button is hidden; pages without plans pass a navigate-to-plans handler.
	onUpgrade?: () => void;
	onBuyCredits: () => void;
}

export function UsageCreditsCard({ balance, description, onUpgrade, onBuyCredits }: Readonly<UsageCreditsCardProps>) {
	// On the top tier there's nothing to upgrade to — hide the button.
	const { canUpgrade } = useCanUpgrade();
	return (
		<section className="rounded-xl border border-border bg-card/50 p-6">
			<h2 className="mb-1 text-lg font-semibold">Usage credits</h2>
			<p className="mb-4 text-sm text-muted-foreground">{description}</p>
			<div className="flex items-center justify-between border-t border-border pt-4">
				<div>
					<div className="text-xl font-bold">${balance.toFixed(2)}</div>
					<div className="text-sm text-muted-foreground">Current balance</div>
				</div>
				<div className="flex gap-2">
					{onUpgrade && canUpgrade && (
						<Button variant="outline" onClick={onUpgrade}>
							Upgrade plan
						</Button>
					)}
					<Button onClick={onBuyCredits}>Buy credits</Button>
				</div>
			</div>
		</section>
	);
}
