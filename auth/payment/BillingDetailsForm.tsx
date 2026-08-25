import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import type { BillingDetailsUpdate } from "../../inference-sdk";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Skeleton } from "../../ui/skeleton";
import { useBillingDetails, useUpdateBillingDetails } from "./use-invoices";

type Fields = Required<{ [K in keyof BillingDetailsUpdate]: string }>;

const EMPTY: Fields = {
	name: "",
	address_line1: "",
	address_line2: "",
	postal_code: "",
	city: "",
	country: "",
	vat_number: "",
};

const FIELD_ROWS: { key: keyof Fields; label: string; maxLength: number; half?: boolean }[] = [
	{ key: "name", label: "Name / Company", maxLength: 200 },
	{ key: "address_line1", label: "Address line 1", maxLength: 200 },
	{ key: "address_line2", label: "Address line 2", maxLength: 200 },
	{ key: "postal_code", label: "Postal code", maxLength: 32, half: true },
	{ key: "city", label: "City", maxLength: 128, half: true },
	{ key: "country", label: "Country", maxLength: 64, half: true },
	{ key: "vat_number", label: "VAT number", maxLength: 32, half: true },
];

const fromApi = (data: Partial<BillingDetailsUpdate> | undefined): Fields => ({
	...EMPTY,
	...Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [k, v ?? ""])),
});

/**
 * Optional billing identity printed on future invoices (already-issued invoices never change).
 * The API's PUT is a full replace, so the form always submits the complete object.
 */
export function BillingDetailsForm() {
	const { data, isLoading } = useBillingDetails();
	const update = useUpdateBillingDetails();
	const [fields, setFields] = useState<Fields>(EMPTY);

	useEffect(() => {
		if (data) setFields(fromApi(data));
	}, [data]);

	const dirty = JSON.stringify(fields) !== JSON.stringify(fromApi(data));

	const save = () => {
		const body = Object.fromEntries(
			Object.entries(fields).map(([k, v]) => [k, v.trim() || null]),
		) as BillingDetailsUpdate;
		update.mutate(body);
	};

	return (
		<section className="rounded-xl border border-border bg-card/50 p-6">
			<h2 className="mb-1 flex items-center gap-3 text-lg font-semibold">
				<Building2 className="w-5 h-5" />
				Billing details
			</h2>
			<p className="text-sm text-muted-foreground mb-4">
				Optional. Add your company name, address and VAT number to have them printed on your future invoices.
			</p>
			{isLoading ? (
				<div className="space-y-2">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-2/3" />
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{FIELD_ROWS.map(({ key, label, maxLength, half }) => (
						<div key={key} className={half ? "" : "sm:col-span-2"}>
							<Label htmlFor={`billing-${key}`}>{label}</Label>
							<Input
								id={`billing-${key}`}
								className="mt-1"
								value={fields[key]}
								maxLength={maxLength}
								onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
							/>
						</div>
					))}
					<div className="sm:col-span-2 flex justify-end">
						<Button onClick={save} disabled={!dirty || update.isPending}>
							{update.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
							Save
						</Button>
					</div>
				</div>
			)}
		</section>
	);
}
