import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	type BillingDetailsUpdate,
	downloadInvoicePdfInvoicesInvoiceIdPdfGet,
	getBillingDetailsInvoicesBillingDetailsGet,
	listInvoicesInvoicesGet,
	updateBillingDetailsInvoicesBillingDetailsPut,
} from "../../inference-sdk";
import { useAccountStore } from "../account";

export const INVOICES_PAGE_SIZE = 20;

const unwrap = <T>(response: { data?: T; error?: unknown }, fallback: string): T => {
	if (response.error) {
		const detail = (response.error as { detail?: unknown })?.detail;
		throw new Error(detail ? detail.toString() : fallback);
	}
	return response.data as T;
};

/** One page of the session's invoices, newest first. Card (Revolut) payments only —
 * crypto top-ups don't produce invoices. */
export function useInvoices(page: number) {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: ["invoices", page],
		queryFn: async () =>
			unwrap(
				await listInvoicesInvoicesGet({ query: { page, page_size: INVOICES_PAGE_SIZE } }),
				"Failed to load invoices",
			),
		enabled: isAuthenticated,
		placeholderData: keepPreviousData,
		staleTime: 5 * 60 * 1000,
	});
}

export function useBillingDetails() {
	const isAuthenticated = useAccountStore((state) => state.isAuthenticated);
	return useQuery({
		queryKey: ["billingDetails"],
		queryFn: async () => unwrap(await getBillingDetailsInvoicesBillingDetailsGet(), "Failed to load billing details"),
		enabled: isAuthenticated,
	});
}

/** PUT is a full replace: always send the complete object — omitted fields are cleared. */
export function useUpdateBillingDetails() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: BillingDetailsUpdate) =>
			unwrap(await updateBillingDetailsInvoicesBillingDetailsPut({ body }), "Failed to save billing details"),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["billingDetails"] });
			toast.success("Billing details saved", {
				description: "They will appear on your next invoices (already-issued ones are unchanged).",
			});
		},
		onError: (error: Error) => toast.error("Failed to save billing details", { description: error.message }),
	});
}

/** Fetches the PDF (cookie-authenticated, so a plain link won't do) and hands it to the browser. */
export function useDownloadInvoice() {
	return useMutation({
		mutationFn: async ({ id, number }: { id: string; number: string }) => {
			const response = await downloadInvoicePdfInvoicesInvoiceIdPdfGet({
				path: { invoice_id: id },
				responseType: "blob",
			});
			if (response.error) throw new Error("Failed to download invoice");
			const url = URL.createObjectURL(response.data as unknown as Blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `${number}.pdf`;
			link.click();
			URL.revokeObjectURL(url);
		},
		onError: (error: Error) => toast.error("Failed to download invoice", { description: error.message }),
	});
}
