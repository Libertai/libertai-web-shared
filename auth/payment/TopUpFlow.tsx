import { useEffect } from "react";
import { useQueryState } from "nuqs";
import { CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { usePaymentProviders, useSubscription } from "../use-payments";
import { useAccountStore } from "../account";
import { PaymentStage } from "./PaymentStage";
import { TopUpAmountInput } from "./TopUpAmountInput";
import { CardTopUp } from "./CardTopUp";

interface TopUpFlowProps {
	onDone: () => void;
}

type Stage = "select" | "payment" | "success";

export function TopUpFlow({ onDone }: Readonly<TopUpFlowProps>) {
	const qc = useQueryClient();
	const { data: subscription } = useSubscription();
	const { data: providers } = usePaymentProviders();
	const fiatProviderId = providers?.find((p) => p.kind === "fiat")?.id;
	// Walletless (email/OAuth) users pay only by card — give them the one-screen amount picker
	// instead of the wallet flow's amount-entry → method-select → pay sequence.
	const account = useAccountStore((state) => state.account);
	const isCardOnly = !account && !!fiatProviderId;

	const [stage, setStage] = useQueryState<Stage>("stage", {
		defaultValue: "select",
		parse: (v): Stage => (v === "payment" || v === "success" ? v : "select"),
	});
	const [amount] = useQueryState("amount", {
		defaultValue: "",
		parse: (v) => (v !== "" ? v : ""),
		serialize: (v) => (v !== undefined ? v.toString() : ""),
	});

	// Guard deep links like ?stage=payment&amount=abc (or a missing amount): never render the
	// payment stage with an invalid usdAmount — show the select stage and fix the URL.
	const numericAmount = Number(amount);
	const validAmount = Number.isFinite(numericAmount) && numericAmount >= 1;
	const effectiveStage: Stage = stage === "payment" && !validAmount ? "select" : stage;
	useEffect(() => {
		if (stage === "payment" && !validAmount) void setStage("select");
	}, [stage, validAmount, setStage]);

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Buy credits</h1>
				<p className="text-sm text-muted-foreground mt-1">Credits are used once your plan allowance runs out.</p>
			</div>

			{isCardOnly && fiatProviderId ? (
				<CardTopUp fiatProviderId={fiatProviderId} currentBalance={subscription?.prepaid_balance ?? 0} />
			) : (
				<>
					{effectiveStage === "select" && (
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">
								Current balance:{" "}
								<span className="font-semibold text-foreground">
									${(subscription?.prepaid_balance ?? 0).toFixed(2)}
								</span>
							</p>
							<TopUpAmountInput onSelectAmount={() => setStage("payment")} />
						</div>
					)}

					{effectiveStage === "payment" && (
						<PaymentStage
							usdAmount={numericAmount}
							handleGoBackToSelection={() => setStage("select")}
							handlePaymentSuccess={() => {
								setStage("success");
								void qc.invalidateQueries({ queryKey: ["subscription"] });
								void qc.invalidateQueries({ queryKey: ["credits"] });
							}}
						/>
					)}
				</>
			)}

			{!isCardOnly && effectiveStage === "success" && (
				<div className="flex flex-col items-center gap-4 py-8">
					<div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
						<CheckCircle className="h-7 w-7 text-emerald-400" />
					</div>
					<p className="text-center text-sm text-muted-foreground">
						Payment successful — your credits will be added shortly.
					</p>
					<Button onClick={onDone}>Done</Button>
				</div>
			)}
		</div>
	);
}
