import { useSubscription } from "./use-payments";
import { Button } from "./ui/button";

function planState(subscription: { tier?: string; has_subscription?: boolean } | undefined) {
	if (!subscription) return null;
	const tier = subscription.tier ?? "free";
	const isFree = tier === "free" || !subscription.has_subscription;
	return { tier, isFree };
}

/** Muted plan line for the account menu: "Free" on the free tier, "<Tier> plan" when subscribed. */
export function PlanLabel() {
	const { data: subscription } = useSubscription();
	const state = planState(subscription);
	if (!state) return null;
	return <span className="capitalize">{state.isFree ? "Free" : `${state.tier} plan`}</span>;
}

export type PlanUpgradeButtonProps = {
	/** Called when the user clicks Upgrade (app routes to its plans/billing page). */
	onUpgrade?: () => void;
};

/** Right-aligned "Upgrade" pill for the account menu — only renders for free-tier users. */
export function PlanUpgradeButton({ onUpgrade }: PlanUpgradeButtonProps) {
	const { data: subscription } = useSubscription();
	const state = planState(subscription);
	if (!state || !state.isFree) return null;
	return (
		<Button size="sm" variant="outline" className="rounded-full" onClick={() => onUpgrade?.()}>
			Upgrade
		</Button>
	);
}
