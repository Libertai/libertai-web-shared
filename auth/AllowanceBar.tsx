function formatCountdown(resetsAt: string | null | undefined, now: number): string | null {
	if (!resetsAt) return null;
	const diff = new Date(resetsAt).getTime() - now;
	if (diff <= 0) return null;
	const s = Math.floor(diff / 1000);
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${sec}s`;
	return `${sec}s`;
}

export function AllowanceBar({
	label,
	used,
	limit,
	resetsAt,
	now,
}: Readonly<{ label: string; used: number; limit: number; resetsAt?: string | null; now: number }>) {
	const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
	const countdown = formatCountdown(resetsAt, now);
	return (
		<div>
			<div className="flex justify-between text-sm mb-1">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium">{pct}% used</span>
			</div>
			<div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
				<div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
			</div>
			{countdown && <p className="text-xs text-muted-foreground mt-1 text-right">Resets in {countdown}</p>}
		</div>
	);
}
