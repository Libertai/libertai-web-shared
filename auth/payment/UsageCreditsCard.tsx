import { Button } from "../ui/button";

interface UsageCreditsCardProps {
	balance: number;
	description: string;
	onUpgrade: () => void;
	onBuyCredits: () => void;
}

export function UsageCreditsCard({ balance, description, onUpgrade, onBuyCredits }: Readonly<UsageCreditsCardProps>) {
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
					<Button variant="outline" onClick={onUpgrade}>
						Upgrade plan
					</Button>
					<Button onClick={onBuyCredits}>Buy credits</Button>
				</div>
			</div>
		</section>
	);
}
