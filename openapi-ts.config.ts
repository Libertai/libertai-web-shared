import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
	input: "http://localhost:8000/openapi.json",
	output: {
		// Prettier matches the consuming apps' style (.prettierrc.yaml here mirrors theirs). No eslint
		// step: web-shared has no eslint config, and the apps' eslint runs over the consumed source anyway.
		path: "./inference-sdk",
		postProcess: ["prettier"],
	},
	plugins: ["@hey-api/client-axios"],
});
