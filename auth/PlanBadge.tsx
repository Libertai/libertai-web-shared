import { useSubscription } from "./use-payments";
import { Button } from "./ui/button";

export type PlanBadgeProps = {
	/** Called when the user clicks Upgrade (app routes to its plans/billing page). */
	onUpgrade?: () => void;
};

/**
 * Compact plan indicator for the account menu. Free users see "Free" + an Upgrade button
 * (ChatGPT-style); subscribed users see "<Tier> plan" (Claude-style). Renders nothing until
 * the subscription query resolves (avoids a flicker of the wrong state).
 */
export function PlanBadge({ onUpgrade }: PlanBadgeProps) {
	const { data: subscription } = useSubscription();
	if (!subscription) return null;

	const tier = subscription.tier ?? "free";
	const isFree = tier === "free" || !subscription.has_subscription;

	if (isFree) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground">Free</span>
				{onUpgrade && (
					<Button
						size="sm"
						variant="outline"
						className="h-6 px-2 text-xs"
						onClick={(e) => {
							e.stopPropagation();
							onUpgrade();
						}}
					>
						Upgrade
					</Button>
				)}
			</div>
		);
	}

	return <span className="text-xs text-muted-foreground capitalize">{tier} plan</span>;
}
