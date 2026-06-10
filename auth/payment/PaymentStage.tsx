import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "../ui/button";
import { PaymentMethod, PaymentMethodSelector } from "./PaymentMethodSelector";
import { CheckoutWidget } from "thirdweb/react";
import { base } from "thirdweb/chains";
import { PaymentForm } from "./PaymentForm";
import { useLTAIPrice } from "./use-ltai-price";
import { useSOLPrice } from "./use-sol-price";
import { useAccountStore } from "../account";
import { useQueryState } from "nuqs";
import { prepareContractCall, sendTransaction } from "thirdweb";
import { parseUnits } from "viem";
import { toast } from "sonner";
import {
	createAssociatedTokenAccountInstruction,
	getAssociatedTokenAddress,
	TOKEN_2022_PROGRAM_ID,
	TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
	Connection,
	PublicKey,
	SimulateTransactionConfig,
	SystemProgram,
	Transaction,
	TransactionMessage,
	VersionedTransaction,
} from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import { waitForBaseTransaction } from "./transactions";
import idl from "./solana/libertai_payment_processor.json";
import { LibertaiPaymentProcessor } from "./solana/libertai_payment_processor";
import { usePaymentConfig } from "./config";
import { Skeleton } from "../ui/skeleton";
import { useBillingActions, usePaymentRegion } from "../use-payments";
import { TopUpPackPicker } from "./TopUpPackPicker";

type PaymentStageProps = {
	usdAmount: number;
	handleGoBackToSelection: () => void;
	handlePaymentSuccess: () => void;
	/** Fiat (card) provider id — undefined hides the card option entirely. */
	fiatProviderId?: string;
};

export const PaymentStage = ({
	usdAmount,
	handleGoBackToSelection,
	handlePaymentSuccess,
	fiatProviderId,
}: PaymentStageProps) => {
	const { thirdwebClient, solanaRpc, paymentProcessorBaseAddress, usdcBaseAddress, ltaiSolanaAddress } =
		usePaymentConfig();

	const solanaConnection = useMemo(() => new Connection(solanaRpc, "confirmed"), [solanaRpc]);
	const solanaProgram = useMemo(
		() => new Program(idl as LibertaiPaymentProcessor, { connection: solanaConnection }),
		[solanaConnection],
	);
	const solanaTokenMint = useMemo(() => new PublicKey(ltaiSolanaAddress), [ltaiSolanaAddress]);
	const PAYMENT_PROCESSOR_ADDRESS = paymentProcessorBaseAddress as `0x${string}`;

	const solBalance = useAccountStore((state) => state.solBalance);
	const ltaiBalance = useAccountStore((state) => state.ltaiBalance);
	const account = useAccountStore((state) => state.account);
	// The session user id (present for wallet AND email/OAuth users) — credits the right account
	// even when the payment wallet isn't the user's own (email users pay via a just-connected wallet).
	const me = useAccountStore((state) => state.me) as { id?: string } | null;
	const setLastTransactionHash = useAccountStore((state) => state.setLastTransactionHash);
	const getLTAIBalance = useAccountStore((state) => state.getLTAIBalance);
	const getSOLBalance = useAccountStore((state) => state.getSOLBalance);

	const { price: ltaiPrice, isLoading: isLtaiPriceLoading, getRequiredLTAI } = useLTAIPrice();
	const { price: solPrice, isLoading: isSolPriceLoading, getRequiredSOL } = useSOLPrice();
	const { data: region, isLoading: isRegionLoading } = usePaymentRegion();
	const { topup } = useBillingActions();

	const originalLtaiAmount = getRequiredLTAI(usdAmount, false);
	const originalSolAmount = getRequiredSOL(usdAmount);
	const discountedLtaiAmount = getRequiredLTAI(usdAmount, true);

	// Default to the wallet's native LTAI option; non-wallet (email/OAuth) users default to card
	// when a fiat provider is available, otherwise crypto.
	const defaultMethod: PaymentMethod =
		account?.chain === "base"
			? "ltai"
			: account?.chain === "solana"
				? "solana"
				: !account && fiatProviderId
					? "card"
					: "crypto";
	const [method, setMethod] = useQueryState<PaymentMethod>("method", {
		defaultValue: defaultMethod,
		parse: (value): PaymentMethod => {
			switch (value) {
				case "card":
					return fiatProviderId ? "card" : defaultMethod;
				case "ltai":
				case "solana":
				case "crypto":
					return value;
				default:
					return defaultMethod;
			}
		},
	});

	const hasLTAI = ltaiBalance > 0;

	const handleLtaiPayment = async () => {
		if (!ltaiPrice || !discountedLtaiAmount) return;

		// Only advance to the success screen when the payment actually confirms — a rejected tx,
		// insufficient funds, or a contract/confirmation error must NOT look like success.
		let succeeded = false;

		if (account?.chain === "base") {
			try {
				// Call the processPayment function using method directly
				const transaction = prepareContractCall({
					contract: {
						address: PAYMENT_PROCESSOR_ADDRESS,
						abi: [
							{
								inputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
								name: "processPayment",
								outputs: [],
								stateMutability: "nonpayable",
								type: "function",
							},
						],
						chain: base,
						client: thirdwebClient,
					},
					method: "processPayment",
					params: [parseUnits(discountedLtaiAmount.toString(), 18)],
				});

				// Send the transaction
				const { transactionHash } = await sendTransaction({
					transaction,
					account: account.provider,
				});

				// Store the transaction hash for display
				setLastTransactionHash(transactionHash);

				// Create a pending toast
				const toastId = toast.loading("Waiting for payment confirmation...");

				try {
					// Wait for the transaction to be confirmed
					await waitForBaseTransaction(thirdwebClient, transactionHash);

					// Update the toast
					toast.success("Payment successful", {
						id: toastId,
					});

					// After successful payment, update the LTAI balance and flag success.
					await getLTAIBalance();
					succeeded = true;
				} catch (confirmError) {
					console.error("Payment confirmation error:", confirmError);
					toast.error("Payment confirmation failed", {
						id: toastId,
						description:
							confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
					});
				}
			} catch (error) {
				console.error("Payment error:", error);
				toast.error("Payment failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
		} else if (account?.chain === "solana" && account.provider.publicKey !== null) {
			try {
				const amount = parseUnits(discountedLtaiAmount.toString(), 9);

				const mintAccountInfo = await solanaConnection.getAccountInfo(solanaTokenMint);
				if (!mintAccountInfo) {
					throw new Error("Token mint account not found");
				}

				const tokenProgramId = mintAccountInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
					? TOKEN_2022_PROGRAM_ID
					: TOKEN_PROGRAM_ID;

				const userTokenAccount = await getAssociatedTokenAddress(
					solanaTokenMint,
					account.provider.publicKey,
					false,
					tokenProgramId,
				);

				const accountInfo = await solanaConnection.getAccountInfo(userTokenAccount);

				const instructions = [];
				if (!accountInfo) {
					const createTokenAccountIx = createAssociatedTokenAccountInstruction(
						account.provider.publicKey,
						userTokenAccount,
						account.provider.publicKey,
						solanaTokenMint,
						tokenProgramId,
					);
					instructions.push(createTokenAccountIx);
				}

				const [programTokenAccountPDA] = PublicKey.findProgramAddressSync(
					[Buffer.from("program_token_account"), solanaTokenMint.toBuffer()],
					solanaProgram.programId,
				);

				const paymentIx = await solanaProgram.methods
					.processPayment(new BN(amount))
					.accounts({
						user: account.provider.publicKey,
						userTokenAccount: userTokenAccount,
						programTokenAccount: programTokenAccountPDA,
						tokenMint: solanaTokenMint,
						tokenProgram: tokenProgramId,
					})
					.instruction();

				instructions.push(paymentIx);

				const { blockhash } = await solanaConnection.getLatestBlockhash();

				const messageV0 = new TransactionMessage({
					payerKey: account.provider.publicKey,
					recentBlockhash: blockhash,
					instructions: instructions,
				}).compileToV0Message();

				const versionedTx = new VersionedTransaction(messageV0);

				try {
					const config: SimulateTransactionConfig = {
						sigVerify: false,
						commitment: "confirmed",
					};
					const simulation = await solanaConnection.simulateTransaction(versionedTx, config);
					if (simulation.value.err) {
						throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
					}
				} catch (simError) {
					console.error("Simulation error:", simError);
					throw new Error(
						`Transaction simulation failed: ${simError instanceof Error ? simError.message : String(simError)}`,
					);
				}
				const tx = new Transaction().add(...instructions);
				tx.recentBlockhash = blockhash;
				tx.feePayer = account.provider.publicKey;
				const sig = await account.provider.sendTransaction(tx, solanaConnection, {
					skipPreflight: true, // Skip preflight since we already simulated
					preflightCommitment: "confirmed",
					maxRetries: 3,
				});

				setLastTransactionHash(sig);

				const toastId = toast.loading("Waiting for payment confirmation...");
				const latestBlockHash = await solanaConnection.getLatestBlockhash();
				try {
					await solanaConnection.confirmTransaction(
						{
							blockhash: blockhash,
							lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
							signature: sig,
						},
						"confirmed",
					);

					toast.success("Payment successful", {
						id: toastId,
					});

					await getLTAIBalance();
					succeeded = true;
				} catch (confirmError) {
					console.error("Payment confirmation error:", confirmError);
					toast.error("Payment confirmation failed", {
						id: toastId,
						description:
							confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
					});
				}
			} catch (error) {
				console.error("Payment error:", error);
				toast.error("Payment failed", {
					description: error instanceof Error ? error.message : "Unknown error",
				});
			}
		} else {
			toast.error("Unsupported chain for LTAI payments. Please switch to Solana or Base.");
			return;
		}

		if (succeeded) handlePaymentSuccess();
	};

	const handleSolPayment = async () => {
		if (account?.chain !== "solana" || !account.provider?.publicKey || !solPrice) {
			return;
		}

		const instructions = [];
		const { blockhash } = await solanaConnection.getLatestBlockhash();
		const [programState] = PublicKey.findProgramAddressSync([Buffer.from("program_state")], solanaProgram.programId);
		const amount = parseUnits(originalSolAmount.toString(), 9);
		const ix = await solanaProgram.methods
			.processPaymentSol(new BN(amount))
			.accounts({
				user: account.provider.publicKey,
				programState: programState,
				systemProgram: SystemProgram.programId,
			})
			.instruction();
		instructions.push(ix);

		const messageV0 = new TransactionMessage({
			payerKey: account.provider.publicKey,
			recentBlockhash: blockhash,
			instructions: instructions,
		}).compileToV0Message();
		const versionedTx = new VersionedTransaction(messageV0);

		try {
			const config: SimulateTransactionConfig = {
				sigVerify: false,
				commitment: "confirmed",
			};
			const simulation = await solanaConnection.simulateTransaction(versionedTx, config);
			if (simulation.value.err) {
				throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
			}
		} catch (simError) {
			console.error("Simulation error:", simError);
			throw new Error(
				`Transaction simulation failed: ${simError instanceof Error ? simError.message : String(simError)}`,
			);
		}

		const tx = new Transaction().add(...instructions);
		tx.recentBlockhash = blockhash;
		tx.feePayer = account.provider.publicKey;

		const sig = await account.provider.sendTransaction(tx, solanaProgram.provider.connection, {
			skipPreflight: true, // Skip preflight since we already simulated
			preflightCommitment: "confirmed",
			maxRetries: 3,
		});

		setLastTransactionHash(sig);

		const toastId = toast.loading("Waiting for payment confirmation...");
		const latestBlockHash = await solanaConnection.getLatestBlockhash();

		try {
			await solanaConnection.confirmTransaction(
				{
					blockhash: blockhash,
					lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
					signature: sig,
				},
				"confirmed",
			);

			toast.success("Payment successful", {
				id: toastId,
			});

			await getSOLBalance();
			// Only advance to success after a confirmed payment (not in `finally`, which fired on errors too).
			handlePaymentSuccess();
		} catch (confirmError) {
			console.error("Payment confirmation error:", confirmError);
			toast.error("Payment confirmation failed", {
				id: toastId,
				description: confirmError instanceof Error ? confirmError.message : "Transaction may not have been confirmed",
			});
		}
	};

	return (
		<div className="max-w-2xl mx-auto space-y-6">
			{/* Header row: back button + total */}
			<div className="flex items-center gap-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						// Clear the persisted method so re-entering the payment stage recomputes the default.
						void setMethod(null);
						handleGoBackToSelection();
					}}
				>
					<ChevronLeft className="h-4 w-4 mr-1" />
					Back
				</Button>
				<span className="text-sm text-muted-foreground">
					Total: <span className="font-semibold text-foreground">${usdAmount.toFixed(2)}</span>
				</span>
			</div>

			{/* Payment method selector */}
			<PaymentMethodSelector
				onSelectMethod={setMethod}
				selectedMethod={method as PaymentMethod}
				hasLTAI={hasLTAI}
				chain={account?.chain}
				fiatAvailable={!!fiatProviderId}
			/>

			{/* Selected method widget */}
			<div>
				{method === "card" &&
					fiatProviderId &&
					// Wait for the region before branching so EUR users never flash the USD card UI.
					(isRegionLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-5 w-48" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : region?.currency === "EUR" ? (
						<div className="space-y-3">
							<p className="text-xs text-muted-foreground">Card top-ups in EUR use fixed packs.</p>
							<TopUpPackPicker fiatProviderId={fiatProviderId} />
						</div>
					) : (
						// USD region: arbitrary amount, redirect to hosted checkout.
						// The /payment/callback page handles the post-payment flow — no handlePaymentSuccess here.
						// isSuccess keeps the button disabled between mutate resolving and the browser navigating away.
						<div className="bg-card/50 backdrop-blur-sm p-6 rounded-xl border border-border space-y-4">
							<p className="text-sm text-muted-foreground">
								You will be charged{" "}
								<span className="font-semibold text-foreground">${usdAmount.toFixed(2)}</span> via Revolut.
							</p>
							<Button
								className="w-full"
								disabled={topup.isPending || topup.isSuccess}
								onClick={() => topup.mutate({ provider: fiatProviderId, amount: usdAmount })}
							>
								{topup.isPending || topup.isSuccess
									? "Redirecting to checkout..."
									: `Pay $${usdAmount.toFixed(2)} by card`}
							</Button>
						</div>
					))}
				{method === "crypto" && (
					<CheckoutWidget
						client={thirdwebClient}
						chain={base}
						amount={usdAmount.toString()}
						seller={paymentProcessorBaseAddress as `0x${string}`}
						tokenAddress={usdcBaseAddress as `0x${string}`}
						name="Checkout"
						description={`${usdAmount.toFixed(2)}$ of LibertAI credits`}
						paymentMethods={["crypto"]}
						purchaseData={{
							userId: me?.id,
						}}
						onSuccess={() => {
							setLastTransactionHash(null);
							handlePaymentSuccess();
						}}
						className="!w-full"
					/>
				)}
				{method === "ltai" && (
					<PaymentForm
						handlePayment={handleLtaiPayment}
						ticker="LTAI"
						tokenAmount={originalLtaiAmount}
						discountedAmount={discountedLtaiAmount}
						balance={ltaiBalance}
						displayedDecimals={2}
						isLoading={isLtaiPriceLoading}
					/>
				)}
				{method === "solana" && (
					<PaymentForm
						handlePayment={handleSolPayment}
						ticker="SOL"
						tokenAmount={originalSolAmount}
						balance={solBalance}
						displayedDecimals={4}
						isLoading={isSolPriceLoading}
					/>
				)}
			</div>
		</div>
	);
};
