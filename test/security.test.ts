import assert from "node:assert";

import { formatFatalError, hasValidBearerToken, isLocalSseHost, validateSseAuthConfiguration } from "../src/index";
import { sanitizeForLog } from "../src/logger";

describe("security defaults", () => {
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
