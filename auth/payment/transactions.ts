import { eth_getTransactionReceipt, getRpcClient, type ThirdwebClient } from "thirdweb";
import { base } from "thirdweb/chains";

/**
 * Helper function to wait for transaction confirmation
 */
export const waitForBaseTransaction = async (
	client: ThirdwebClient,
	transactionHash: `0x${string}`,
	maxAttempts = 20,
) => {
	const rpcClient = getRpcClient({ client, chain: base });
	for (let i = 0; i < maxAttempts; i++) {
		try {
			const receipt = await eth_getTransactionReceipt(rpcClient, {
				hash: transactionHash,
			});

			if (receipt && receipt.status === "success") {
				return receipt;
			}

			// Wait before next attempt
			await new Promise((resolve) => setTimeout(resolve, 3000));
		} catch (_error) {
			// Receipt might not be available yet
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}
	throw new Error("Transaction confirmation timeout");
};
