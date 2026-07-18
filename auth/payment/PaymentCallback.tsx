import { useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "../../ui/button";
import { useSubscription } from "../use-payments";

interface PaymentCallbackProps {
	/** Where the Continue / back buttons should land (e.g. "/" or "/settings"). */
	backTo: string;
	/** App-supplied navigation — keeps this component router-agnostic. */
	navigate: (to: string) => void;
}

/**
 * Landing page for hosted checkout returns (Revolut redirects here before the webhook confirms the
 * payment). Polls the subscription endpoint and decides the outcome by comparing against the first
 * loaded snapshot:
 * - SUCCESS (latches, wins over everything): the subscription activated while watching (`status`
 *   flipped to "active"), or a top-up landed (`prepaid_balance` rose above the initial value).
 * - FAILURE: `status` polls as "overdue" (payment declined/failed).
 * - SOFT-DONE: if the FIRST snapshot is already "active" (the webhook beat the redirect — common),
 *   we can't tell a finished subscription from a still-pending top-up, so after 10s without a
 *   balance change we show a neutral "Almost there" state — while still polling, so a late webhook
 *   can upgrade it to a real confirmation.
 * - TIMEOUT: after 40s without any of the above, a neutral "still processing" message with a way back.
 * Polling stops once a terminal state (success/failure/timeout) is reached.
 */
export function PaymentCallback({ backTo, navigate }: Readonly<PaymentCallbackProps>) {
	const queryClient = useQueryClient();

	const [success, setSuccess] = useState(false);
	const [failed, setFailed] = useState(false);
	const [softDone, setSoftDone] = useState(false);
	const [timedOut, setTimedOut] = useState(false);

	// Stop polling on terminal states. Soft-done is NOT terminal — keep polling through it.
	const terminal = success || failed || timedOut;
	const { data } = useSubscription({ refetchInterval: terminal ? false : 2000 });

	// First loaded snapshot — the comparison baseline. Set once, in an effect, so renders stay pure.
	// Declared before the outcome effect so the baseline exists when the outcome effect first runs.
	const initialRef = useRef<{ status: string | null; balance: number } | null>(null);
	useEffect(() => {
		if (data && initialRef.current === null) {
			initialRef.current = { status: data.status ?? null, balance: data.prepaid_balance ?? 0 };
		}
	}, [data]);

	// Derive the outcome from each poll. Success latches and wins even if a failure poll follows.
	useEffect(() => {
		const initial = initialRef.current;
		if (!data || !initial) return;
		const confirmed =
			(data.status === "active" && initial.status !== "active") || (data.prepaid_balance ?? 0) > initial.balance;
		if (confirmed) {
			setSuccess(true);
		} else if (data.status === "overdue") {
			setFailed(true);
		}
	}, [data]);

	useEffect(() => {
		const softTimer = setTimeout(() => setSoftDone(true), 10_000);
		const hardTimer = setTimeout(() => setTimedOut(true), 40_000);
		return () => {
			clearTimeout(softTimer);
			clearTimeout(hardTimer);
		};
	}, []);

	// Webhook-beat-the-redirect heuristic: already active at first load and no movement after 10s.
	const probablyDone = !success && !failed && softDone && initialRef.current?.status === "active";

	// Refresh dependent views once on (probable) completion (balance/plan widgets elsewhere in the app).
	const invalidatedRef = useRef(false);
	const done = success || probablyDone;
	useEffect(() => {
		if (done && !invalidatedRef.current) {
			invalidatedRef.current = true;
			void queryClient.invalidateQueries({ queryKey: ["subscription"] });
			void queryClient.invalidateQueries({ queryKey: ["credits"] });
		}
	}, [done, queryClient]);

	if (success) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-8">
				<div className="flex flex-col items-center gap-4 py-8">
					<div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
						<CheckCircle className="h-7 w-7 text-emerald-400" />
					</div>
					<p className="text-lg font-semibold">Payment confirmed!</p>
					<Button onClick={() => navigate(backTo)}>Continue</Button>
				</div>
			</div>
		);
	}

	if (failed) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-8">
				<div className="flex flex-col items-center gap-4 py-8">
					<div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center">
						<XCircle className="h-7 w-7 text-red-400" />
					</div>
					<p className="text-lg font-semibold">Payment didn&apos;t complete</p>
					<p className="text-center text-sm text-muted-foreground">
						Your payment was declined or failed — no charge was confirmed.
					</p>
					<Button onClick={() => navigate(backTo)}>Back</Button>
				</div>
			</div>
		);
	}

	if (probablyDone) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-8">
				<div className="flex flex-col items-center gap-4 py-8">
					<p className="text-lg font-semibold">Almost there</p>
					<p className="text-center text-sm text-muted-foreground">
						Your payment is being finalized — it can take a moment to appear in your account.
					</p>
					<Button onClick={() => navigate(backTo)}>Continue</Button>
				</div>
			</div>
		);
	}

	if (timedOut) {
		return (
			<div className="max-w-2xl mx-auto px-4 py-8">
				<div className="flex flex-col items-center gap-4 py-8">
					<p className="text-center text-sm text-amber-500">
						Still processing — this can take a little longer. You can head back; your payment will appear shortly.
					</p>
					<Button onClick={() => navigate(backTo)}>Go back</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<div className="flex flex-col items-center gap-4 py-8">
				<Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
				<p className="text-lg font-semibold">Finalizing your payment…</p>
				<p className="text-center text-sm text-muted-foreground">This usually takes a few seconds.</p>
			</div>
		</div>
	);
}
