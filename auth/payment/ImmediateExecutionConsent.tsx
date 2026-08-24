import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

const CGV_URL = "https://libertai.io/cgv";

interface ImmediateExecutionConsentProps {
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** Shown when the user tries to pay without ticking. */
	showError?: boolean;
	className?: string;
}

/**
 * Consumer withdrawal-right waiver, required before any paid digital service that starts
 * immediately.
 *
 * French law (art. L.221-18 code de la consommation) gives consumers 14 days to withdraw from a
 * distance contract. For digital content and services supplied at once, art. L.221-28 13° only
 * lifts that right if the consumer BOTH expressly asks for immediate performance AND acknowledges
 * losing the right — hence two statements in one un-pre-ticked box. Without this, every purchase
 * stays refundable for 14 days regardless of what the CGV say.
 *
 * The box must never default to checked: a pre-ticked box is not valid consent.
 */
export function ImmediateExecutionConsent({
	checked,
	onChange,
	showError = false,
	className,
}: Readonly<ImmediateExecutionConsentProps>) {
	const errorId = useId();
	const invalid = showError && !checked;

	return (
		<div className={className}>
			<label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
				{/* appearance-none: a native checkbox ignores border/background, so the error and
				    checked states have to be drawn here. */}
				<span className="relative mt-0.5 inline-flex size-4 shrink-0">
					<input
						type="checkbox"
						checked={checked}
						onChange={(e) => onChange(e.target.checked)}
						aria-invalid={invalid}
						aria-describedby={invalid ? errorId : undefined}
						className={cn(
							"peer size-4 shrink-0 cursor-pointer appearance-none rounded border border-border bg-input shadow-xs transition-[color,box-shadow] outline-none",
							"checked:border-primary checked:bg-primary",
							"focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
							"aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:ring-[3px]",
						)}
					/>
					<Check className="pointer-events-none absolute inset-0 m-auto size-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />
				</span>
				<span>
					I ask for the service to start immediately and I acknowledge that I lose my 14-day right of withdrawal once it
					has been performed.{" "}
					<a
						className="underline underline-offset-2 hover:text-foreground"
						href={CGV_URL}
						rel="noopener"
						target="_blank"
					>
						Terms of sale
					</a>
				</span>
			</label>
			{invalid && (
				<p id={errorId} role="alert" className="mt-1.5 pl-7 text-xs text-destructive">
					Please confirm this to continue.
				</p>
			)}
		</div>
	);
}
