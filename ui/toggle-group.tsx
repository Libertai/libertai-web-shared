import { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";

export function ToggleGroup({
	value,
	onValueChange,
	options,
	className,
}: {
	value: string;
	onValueChange: (value: string) => void;
	options: Array<{ value: string; label: ReactNode }>;
	className?: string;
}) {
	return (
		<div className={cn("inline-flex rounded-lg border border-border bg-card p-1 gap-1", className)}>
			{options.map((option) => (
				<Button
					key={option.value}
					size="sm"
					variant={value === option.value ? "default" : "ghost"}
					onClick={() => onValueChange(option.value)}
				>
					{option.label}
				</Button>
			))}
		</div>
	);
}
