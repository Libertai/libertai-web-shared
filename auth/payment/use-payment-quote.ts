import { useQuery } from "@tanstack/react-query";
import { createTokenPaymentQuoteCreditsQuotesPost } from "../../inference-sdk";
import type { QuoteToken, TokenPaymentQuoteResponse } from "../../inference-sdk";
import { useAccountStore } from "../account";

export type PaymentQuote = TokenPaymentQuoteResponse & {
	/** Exact amount to send, in the token's smallest unit: any other amount is valued at the market price. */
	rawAmount: bigint;
	/** rawAmount in whole tokens, for display only. */
	amount: number;
};

// Well inside the backend's 15 min quote TTL, so a displayed quote is always fresh when paid.
const REFRESH_MS = 60 * 1000;

/** Server-issued price lock for paying `usdAmount` of credits with `token` from the connected wallet.
 * Stops refreshing while `frozen`, so an approval and the payment that follows use the same amount. */
export function usePaymentQuote(
	token: QuoteToken,
	usdAmount: number,
	{ enabled = true, frozen = false }: { enabled?: boolean; frozen?: boolean } = {},
) {
	const account = useAccountStore((state) => state.account);

	const quoteQuery = useQuery({
		queryKey: ["payment-quote", account?.chain, account?.address, token, usdAmount],
		queryFn: async (): Promise<PaymentQuote> => {
			const response = await createTokenPaymentQuoteCreditsQuotesPost({
				body: {
					chain: account!.chain,
					token,
					payer_address: account!.address,
					credit_amount: usdAmount,
				},
			});
			if (response.error) {
				throw new Error(response.error.detail ? response.error.detail.toString() : "Unknown error fetching quote");
			}
			const rawAmount = BigInt(response.data.token_amount_raw);
			return { ...response.data, rawAmount, amount: Number(rawAmount) / 10 ** response.data.decimals };
		},
		enabled: enabled && !!account && usdAmount > 0 && (token === "ltai" || account.chain === "solana"),
		refetchInterval: frozen ? false : REFRESH_MS,
		refetchOnWindowFocus: !frozen,
		staleTime: frozen ? Infinity : REFRESH_MS,
	});

	return {
		quote: quoteQuery.data,
		isLoading: quoteQuery.isLoading,
		isError: quoteQuery.isError,
		error: quoteQuery.error,
	};
}
