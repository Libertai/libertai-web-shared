import { AlertCircle } from "lucide-react";
import { Button } from "./button";
import { Card } from "./card";

export function ErrorCard({
	message,
	onRetry,
	plain,
}: {
	message: string;
	onRetry?: () => void;
	/** Render without the Card wrapper, for nesting inside an existing Card. */
	plain?: boolean;
}) {
	const content = (
		<>
			<AlertCircle className="h-8 w-8 text-muted-foreground" aria-hidden />
			<p className="text-muted-foreground">{message}</p>
			{onRetry && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					Retry
				</Button>
			)}
		</>
	);

	if (plain) {
		return <div className="flex flex-col items-center gap-3 py-10 text-center">{content}</div>;
	}

	return <Card className="flex flex-col items-center gap-3 py-10 text-center">{content}</Card>;
}
