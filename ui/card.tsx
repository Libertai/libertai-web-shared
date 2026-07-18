import { cn } from "../lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return <div className={cn("bg-card rounded-xl border border-border shadow-sm p-6", className)} {...props} />;
}

export function CardHeader({
	title,
	icon,
	action,
	className,
}: {
	title: ReactNode;
	icon?: ReactNode;
	action?: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex items-center justify-between mb-6", className)}>
			<h2 className="flex items-center gap-3 text-lg font-semibold">
				{icon}
				{title}
			</h2>
			{action}
		</div>
	);
}
