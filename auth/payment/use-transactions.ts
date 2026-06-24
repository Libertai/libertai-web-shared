import { useQuery } from "@tanstack/react-query";
import { getTransactionHistoryCreditsTransactionsGet } from "../../inference-sdk";
import { useAccountStore } from "../account";

/** Shared transaction-history query. Gates on the cookie session (not the wallet `account`):
 * /credits/transactions is session-based, so email/OAuth users (no wallet) still see their history. */
export function useTransactions() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);

	const transactionsQuery = useQuery({
		queryKey: ["transactions"],
		queryFn: async () => {
			if (!isAuthenticated) {
				return { address: "", transactions: [] };
			}
			const response = await getTransactionHistoryCreditsTransactionsGet();
			if (response.error) {
				throw new Error(
					response.error.detail ? response.error.detail.toString() : "Unknown error fetching transactions",
				);
			}
			return response.data;
		},
		enabled: isAuthenticated,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	return {
		transactions: transactionsQuery.data?.transactions ?? [],
		address: transactionsQuery.data?.address ?? "",
		isLoading: transactionsQuery.isLoading,
		isError: transactionsQuery.isError,
		error: transactionsQuery.error,
	};
}
