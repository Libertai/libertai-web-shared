import { useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { ErrorCard } from "../../ui/error-card";
import { Skeleton } from "../../ui/skeleton";
import { INVOICES_PAGE_SIZE, useDownloadInvoice, useInvoices } from "./use-invoices";

dayjs.extend(utc);

// Amounts arrive as exact decimal strings from the API.
const formatAmount = (amount: string, currency: string) =>
	new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount));

/**
 * The session's invoices (card payments only), newest first, with PDF downloads.
 * Downloads go through fetch — the endpoint is cookie-authenticated, so plain links can't serve it.
 */
export function InvoiceHistory() {
	const [page, setPage] = useState(1);
	const { data, isLoading, isError, refetch, isPlaceholderData } = useInvoices(page);
	const download = useDownloadInvoice();

	const invoices = data?.items;
	const hasNextPage = page * INVOICES_PAGE_SIZE < (data?.total ?? 0);

	return (
		<div className="space-y-4">
			<h2 className="flex items-center gap-3 text-lg font-semibold">
				<FileText className="w-5 h-5" />
				Invoices
			</h2>
			{isLoading ? (
				<div className="space-y-2">
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-full" />
					<Skeleton className="h-8 w-2/3" />
				</div>
			) : isError ? (
				<ErrorCard plain message="Failed to load invoices" onRetry={() => refetch()} />
			) : !invoices?.length && page === 1 ? (
				<p className="text-sm text-muted-foreground">
					No invoices yet. An invoice is issued for every card payment and appears here.
				</p>
			) : (
				<div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-border">
									<th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Date</th>
									<th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">Description</th>
									<th className="px-6 py-4 text-right text-sm font-medium text-muted-foreground">Amount</th>
									<th className="px-6 py-4" />
								</tr>
							</thead>
							<tbody>
								{invoices?.map((invoice) => (
									<tr key={invoice.id} className="border-b border-border/50 hover:bg-card/70">
										{/* Backend timestamps are naive UTC; bare dayjs() would read them as local. */}
										<td className="px-6 py-4 text-sm font-medium">
											{dayjs.utc(invoice.payment_date).local().format("YYYY-MM-DD")}
										</td>
										<td className="px-6 py-4 text-sm text-muted-foreground">
											{invoice.line_label}
											{invoice.period_start && invoice.period_end && (
												<span className="block text-xs">
													{dayjs.utc(invoice.period_start).local().format("MMM D")} to{" "}
													{dayjs.utc(invoice.period_end).local().format("MMM D, YYYY")}
												</span>
											)}
										</td>
										<td className="px-6 py-4 text-sm text-right">
											{formatAmount(invoice.gross_amount, invoice.currency)}
										</td>
										<td className="px-6 py-4 text-right">
											<Button
												variant="ghost"
												size="sm"
												aria-label={`Download invoice ${invoice.number}`}
												disabled={download.isPending && download.variables?.id === invoice.id}
												onClick={() => download.mutate({ id: invoice.id, number: invoice.number })}
											>
												{download.isPending && download.variables?.id === invoice.id ? (
													<Loader2 className="w-4 h-4 animate-spin" />
												) : (
													<Download className="w-4 h-4" />
												)}
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{(page > 1 || hasNextPage) && (
						<div className="flex items-center justify-end gap-2 px-6 py-4">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 1 || isPlaceholderData}
								onClick={() => setPage((p) => p - 1)}
							>
								<ChevronLeft className="w-4 h-4" />
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={!hasNextPage || isPlaceholderData}
								onClick={() => setPage((p) => p + 1)}
							>
								Next
								<ChevronRight className="w-4 h-4" />
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
