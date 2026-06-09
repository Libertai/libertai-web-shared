import { createContext, useContext, ReactNode } from "react";
import type { ThirdwebClient } from "thirdweb";

export interface PaymentConfig {
	thirdwebClient: ThirdwebClient;
	solanaRpc: string;
	paymentProcessorBaseAddress: string; // 0x...
	usdcBaseAddress: string; // 0x...
	ltaiBaseAddress: string; // 0x...
	ltaiSolanaAddress: string;
}

const PaymentConfigContext = createContext<PaymentConfig | null>(null);

export function PaymentConfigProvider({ config, children }: { config: PaymentConfig; children: ReactNode }) {
	return <PaymentConfigContext.Provider value={config}>{children}</PaymentConfigContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePaymentConfig(): PaymentConfig {
	const ctx = useContext(PaymentConfigContext);
	if (!ctx) throw new Error("usePaymentConfig must be used within a PaymentConfigProvider");
	return ctx;
}
