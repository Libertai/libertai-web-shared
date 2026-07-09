import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { updateMeAuthMePatch } from "../../inference-sdk";
import { useAccountStore } from "../account";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useCanUpgrade, useSubscription } from "../use-payments";

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
	// Cap row only renders authenticated (chat /usage shows this card signed-out).
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	const { data: subscription } = useSubscription();
	const queryClient = useQueryClient();

	const cap = subscription?.monthly_extra_credit_cap ?? null;
	const spent = subscription?.extra_credits_used_this_month ?? 0;

	const [capDialogOpen, setCapDialogOpen] = useState(false);
	const [capInput, setCapInput] = useState("");
	const [saving, setSaving] = useState(false);

	const openCapDialog = () => {
		setCapInput(cap != null ? String(cap) : "");
		setCapDialogOpen(true);
	};

	const saveCap = async () => {
		const trimmed = capInput.trim();
		const value = trimmed === "" ? null : Number(trimmed);
		if (value !== null && (!Number.isFinite(value) || value <= 0)) {
			toast.error("Cap must be a positive amount");
			return;
		}
		setSaving(true);
		const response = await updateMeAuthMePatch({ body: { monthly_extra_credit_cap: value } });
		setSaving(false);
		if (response.error) {
			toast.error("Failed to update spend cap");
			return;
		}
		toast.success(value === null ? "Monthly spend cap removed" : `Monthly spend cap set to $${value.toFixed(2)}`);
		setCapDialogOpen(false);
		void queryClient.invalidateQueries({ queryKey: ["subscription"] });
	};

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
			{isAuthenticated && (
				<div className="mt-4 flex items-center justify-between border-t border-border pt-4">
					<div>
						<div className="text-sm font-medium">Monthly spend cap</div>
						<div className="text-sm text-muted-foreground">
							{cap != null ? `$${spent.toFixed(2)} used of $${cap.toFixed(2)} this month` : "Unlimited"}
						</div>
					</div>
					<Button variant="outline" onClick={openCapDialog}>
						Edit
					</Button>
				</div>
			)}
			<Dialog open={capDialogOpen} onOpenChange={(open) => !open && setCapDialogOpen(false)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Monthly spend cap</DialogTitle>
						<DialogDescription>
							Maximum usage credits spent per month once your plan allowance runs out. Leave empty for no limit.
						</DialogDescription>
					</DialogHeader>
					<Input
						type="number"
						min="0"
						step="1"
						placeholder="No limit"
						value={capInput}
						onChange={(e) => setCapInput(e.target.value)}
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCapDialogOpen(false)}>
							Cancel
						</Button>
						<Button onClick={saveCap} disabled={saving}>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
