import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Money, grouped and capped at two decimals: 10447.784 -> "$10,447.78".
// Sub-cent values keep enough decimals to stay non-zero (a $0.004 per-image price must not
// read as "$0.00"), capped at 6 so a rounding artifact can't print a 17-digit tail.
export function formatMoney(value: number, symbol = "$"): string {
	const abs = Math.abs(value);
	const maximumFractionDigits = abs > 0 && abs < 0.01 ? Math.min(6, Math.ceil(-Math.log10(abs)) + 1) : 2;
	// Sign outside the symbol: "-$3.46", not "$-3.46".
	const sign = value < 0 ? "-" : "";
	return `${sign}${symbol}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits })}`;
}
