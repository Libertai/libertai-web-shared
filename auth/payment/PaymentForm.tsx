import { useState } from "react";
import { Button } from "../../ui/button";
import { Loader2 } from "lucide-react";
import { Skeleton } from "../../ui/skeleton";
import { useAccountStore } from "../account";
import { toast } from "sonner";
import { approve } from "thirdweb/extensions/erc20";
import { base } from "thirdweb/chains";
import { sendTransaction } from "thirdweb";
import { waitForBaseTransaction } from "./transactions";
import { usePaymentConfig } from "./config";

interface LTAIPaymentFormProps {
	tokenAmount: number;
	handlePayment: () => void | Promise<void>;
	ticker: string;
	balance: number;
	displayedDecimals: number;
	discountedAmount?: number;
	isLoading?: boolean;
}

export function PaymentForm({
	tokenAmount,
	handlePayment,
	ticker,
	balance,
	displayedDecimals,
	discountedAmount,
	isLoading = false,
}: Readonly<LTAIPaymentFormProps>) {
	const { thirdwebClient, ltaiBaseAddress, paymentProcessorBaseAddress } = usePaymentConfig();

	const account = useAccountStore((state) => state.account);

	const getLTAIBalance = useAccountStore((state) => state.getLTAIBalance);

	const [isApproving, setIsApproving] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isApproved, setIsApproved] = useState(false);

	const LTAI_BASE_CONTRACT_ADDRESS = ltaiBaseAddress as `0x${string}`;
	const PAYMENT_PROCESSOR_ADDRESS = paymentProcessorBaseAddress as `0x${string}`;

	const handleApprovePayment = async () => {
		if (account?.chain !== "base" || !tokenAmount || !discountedAmount) return;

		setIsApproving(true);
		try {
			try {
				// Approve the payment processor to spend LTAI tokens
				const tx = approve({
					contract: {
						address: LTAI_BASE_CONTRACT_ADDRESS,
						chain: base,
						client: thirdwebClient,
					},
					spender: PAYMENT_PROCESSOR_ADDRESS,
					amount: discountedAmount.toString(),
				});

				// Send the transaction and get the hash
				const { transactionHash } = await sendTransaction({ transaction: tx, account: account.provider });

				// Create a pending toast
				const toastId = toast.loading("Waiting for approval confirmation...");

				try {
					// Wait for the transaction to be confirmed
					await waitForBaseTransaction(thirdwebClient, transactionHash);

					// Update the toast
					toast.success("Approval successful", {
						id: toastId,
						description: "Now you can proceed with the payment",
					});

					// Set approval state to true
					setIsApproved(true);

					// After approval, update the LTAI balance
					await getLTAIBalance();
				} catch (confirmError) {
					console.error("Approval confirmation error:", confirmError);
					toast.error("Approval confirmation failed", {
						id: toastId,
						description:
							confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
					});
				}
			} catch (error) {
				console.error("Approval error:", error);
				toast.error("Approval failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			} finally {
				setIsApproving(false);
			}
		} catch (outerError) {
			console.error("Outer error:", outerError);
			setIsApproving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-5 w-48" />
				<Skeleton className="h-5 w-32" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
		);
	}

	const hasEnoughBalance = discountedAmount ? balance >= discountedAmount : balance >= tokenAmount;

	const displayAmount = discountedAmount
		? discountedAmount.toFixed(displayedDecimals)
		: tokenAmount.toFixed(displayedDecimals);

	return (
		<div className="space-y-4">
			{/* Compact amount + balance line */}
			<div className="flex items-center gap-3 flex-wrap">
				<span className="font-semibold">
					≈ {displayAmount} ${ticker}
				</span>
				{discountedAmount && (
					<span className="text-xs font-medium text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded">20% off</span>
				)}
				<span className="text-sm text-muted-foreground ml-auto">
					Balance: {balance.toFixed(displayedDecimals)} ${ticker}
				</span>
			</div>

			{!hasEnoughBalance && (
				<p className="text-sm text-destructive">
					Insufficient ${ticker} balance. Please select another payment method.
				</p>
			)}

			<div className="space-y-3">
				{account?.chain === "base" && (
					<Button
						onClick={handleApprovePayment}
						className="w-full"
						disabled={isApproving || isProcessing || !hasEnoughBalance || isApproved}
					>
						{isApproving ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Approving...
							</>
						) : (
							`1. Approve ${ticker} Spending`
						)}
					</Button>
				)}

				<Button
					onClick={async () => {
						// Await the handler so the processing guard holds for the whole transaction —
						// otherwise the button re-enables immediately and allows double submission.
						setIsProcessing(true);
						try {
							await handlePayment();
						} finally {
							setIsProcessing(false);
						}
					}}
					className="w-full"
					disabled={isProcessing || isApproving || !hasEnoughBalance || (!isApproved && account?.chain === "base")}
				>
					{isProcessing ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Processing Payment...
						</>
					) : (
						`${account?.chain === "solana" ? "" : "2. "}Pay with ${ticker}`
					)}
				</Button>
			</div>
		</div>
	);
}
