import assert from "node:assert";
import os from "node:os";

import { formatFatalError, hasValidBearerToken, isLocalSseHost, validateSseAuthConfiguration } from "../src/index";
import { sanitizeForLog } from "../src/logger";
import { createMcpServer, createTelemetryPayload, isTelemetryEnabled } from "../src/server";

describe("security defaults", () => {
	const originalFetch = globalThis.fetch;
	const originalEnableTelemetry = process.env.MOBILEMCP_ENABLE_TELEMETRY;
	const originalDisableTelemetry = process.env.MOBILEMCP_DISABLE_TELEMETRY;

	afterEach(() => {
		globalThis.fetch = originalFetch;

		if (originalEnableTelemetry === undefined) {
			delete process.env.MOBILEMCP_ENABLE_TELEMETRY;
		} else {
			process.env.MOBILEMCP_ENABLE_TELEMETRY = originalEnableTelemetry;
		}

		if (originalDisableTelemetry === undefined) {
			delete process.env.MOBILEMCP_DISABLE_TELEMETRY;
		} else {
			process.env.MOBILEMCP_DISABLE_TELEMETRY = originalDisableTelemetry;
		}
	});

	it("disables telemetry by default", async () => {
		delete process.env.MOBILEMCP_ENABLE_TELEMETRY;
		delete process.env.MOBILEMCP_DISABLE_TELEMETRY;

		const calls: Array<{ url: unknown, init?: unknown }> = [];
		globalThis.fetch = (async (url: unknown, init?: unknown) => {
			calls.push({ url, init });
			return { ok: true } as Response;
		}) as typeof fetch;

		createMcpServer();
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.equal(isTelemetryEnabled(), false);
		assert.equal(calls.length, 0);
	});

	it("requires explicit telemetry opt-in and lets disable win", () => {
		delete process.env.MOBILEMCP_ENABLE_TELEMETRY;
		delete process.env.MOBILEMCP_DISABLE_TELEMETRY;
		assert.equal(isTelemetryEnabled(), false);

		process.env.MOBILEMCP_ENABLE_TELEMETRY = "1";
		assert.equal(isTelemetryEnabled(), true);

		process.env.MOBILEMCP_DISABLE_TELEMETRY = "1";
		assert.equal(isTelemetryEnabled(), false);
	});

	it("does not put stable host-derived identifiers into telemetry payloads", () => {
		const payload = createTelemetryPayload("launch", {}, "0.0.0-test", "test-client");
		const serialized = JSON.stringify(payload);

		assert.ok(!serialized.includes(os.hostname()));
		assert.ok(!serialized.includes(process.execPath));
		assert.equal(payload.properties.AgentName, "test-client");
	});

	it("redacts sensitive log values", () => {
		const output = sanitizeForLog({
			text: "123456",
			Authorization: "Bearer super-secret",
			url: "https://example.com/private?token=abc",
			ToolName: "mobile_type_keys",
		});

		assert.ok(!output.includes("123456"));
		assert.ok(!output.includes("super-secret"));
		assert.ok(!output.includes("private?token=abc"));
		assert.ok(output.includes("mobile_type_keys"));
	});

	it("allows unauthenticated localhost SSE but requires auth for remote binds", () => {
		assert.equal(isLocalSseHost("localhost"), true);
		assert.equal(isLocalSseHost("127.0.0.1"), true);
		assert.equal(isLocalSseHost("::1"), true);
		assert.equal(isLocalSseHost("0.0.0.0"), false);

		assert.doesNotThrow(() => validateSseAuthConfiguration("localhost"));
		assert.doesNotThrow(() => validateSseAuthConfiguration("0.0.0.0", "secret"));
		assert.throws(() => validateSseAuthConfiguration("0.0.0.0"), /MOBILEMCP_AUTH/);
	});

	it("validates SSE bearer tokens without accepting malformed headers", () => {
		assert.equal(hasValidBearerToken("Bearer secret-token", "secret-token"), true);
		assert.equal(hasValidBearerToken("Bearer wrong-token", "secret-token"), false);
		assert.equal(hasValidBearerToken("Basic secret-token", "secret-token"), false);
		assert.equal(hasValidBearerToken(undefined, "secret-token"), false);
	});

	it("formats fatal startup errors for sanitized logging", () => {
		const formatted = sanitizeForLog(formatFatalError(new Error("startup failed text: \"123456\" Authorization: Bearer super-secret")));

		assert.ok(formatted.includes("startup failed"));
		assert.ok(!formatted.includes("123456"));
		assert.ok(!formatted.includes("super-secret"));
	});
});
