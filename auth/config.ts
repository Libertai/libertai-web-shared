import { client as inferenceClient } from "../inference-sdk/client.gen";

/** Per-app configuration injected at startup so this shared package stays
 *  framework-/env-agnostic (each app reads its own VITE_* vars and passes them in). */
export type LibertaiConfig = {
	/** Inference API base, e.g. https://inference.api.libertai.io — or "/api" behind a dev proxy. */
	apiBaseUrl: string;
	thirdwebClientId: string;
	solanaRpc: string;
	ltaiBaseAddress: string;
	ltaiSolanaAddress: string;
};

let _config: LibertaiConfig | null = null;

/** Call once at app startup (before rendering). Configures the shared inference
 *  client to send the session cookie (no bearer token — auth is cookie-based and
 *  shared across *.libertai.io). */
export function initLibertaiAuth(config: LibertaiConfig): void {
	_config = config;
	inferenceClient.setConfig({
		baseURL: config.apiBaseUrl,
		withCredentials: true, // send/receive the httpOnly session cookie cross-subdomain
	});
}

export function libertaiConfig(): LibertaiConfig {
	if (!_config) {
		throw new Error("initLibertaiAuth() must be called before using the shared auth/SDK");
	}
	return _config;
}
