#!/usr/bin/env node
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer, getAgentVersion } from "./server";
import { error } from "./logger";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import { program } from "commander";

const AUTH_HEADER_PREFIX = "Bearer ";

export const isLocalSseHost = (host: string): boolean => {
	const normalized = host.toLowerCase();
	return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

export const validateSseAuthConfiguration = (host: string, authToken?: string): void => {
	if (!isLocalSseHost(host) && !authToken) {
		throw new Error("MOBILEMCP_AUTH is required when --listen binds to a non-localhost interface.");
	}
};

export const hasValidBearerToken = (authorizationHeader: string | undefined, authToken: string): boolean => {
	if (!authorizationHeader?.startsWith(AUTH_HEADER_PREFIX)) {
		return false;
	}

	const suppliedToken = authorizationHeader.substring(AUTH_HEADER_PREFIX.length);
	const supplied = Buffer.from(suppliedToken);
	const expected = Buffer.from(authToken);

	if (supplied.length !== expected.length) {
		return false;
	}

	return timingSafeEqual(supplied, expected);
};

export const formatFatalError = (err: unknown): string => {
	if (err instanceof Error) {
		return err.stack || err.message;
	}

	return String(err);
};

export const startSseServer = async (host: string, port: number) => {
	const app = express();
	const server = createMcpServer();

	const authToken = process.env.MOBILEMCP_AUTH;
	validateSseAuthConfiguration(host, authToken);

	if (!authToken) {
		error("WARNING: MOBILEMCP_AUTH is not set. The SSE server will accept unauthenticated localhost connections only.");
	}

	if (authToken) {
		app.use((req, res, next) => {
			if (!hasValidBearerToken(req.headers.authorization, authToken)) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			next();
		});
	}

	// Block cross-origin requests — MCP clients are not browsers
	app.use((req, res, next) => {
		if (req.headers.origin) {
			res.status(403).json({ error: "Cross-origin requests are not allowed" });
			return;
		}

		if (req.method === "OPTIONS") {
			res.status(403).end();
			return;
		}

		next();
	});

	let transport: SSEServerTransport | null = null;

	app.post("/mcp", (req, res) => {
		if (transport) {
			transport.handlePostMessage(req, res);
		}
	});

	app.get("/mcp", (req, res) => {
		if (transport) {
			res.status(409).json({ error: "Another client is already connected. Disconnect the existing client first." });
			return;
		}

		transport = new SSEServerTransport("/mcp", res);

		transport.onclose = () => {
			transport = null;
		};

		server.connect(transport);
	});

	app.listen(port, host, () => {
		error(`mobile-mcp ${getAgentVersion()} sse server listening on http://${host}:${port}/mcp`);
	});
};

export const startStdioServer = async () => {
	try {
		const transport = new StdioServerTransport();

		const server = createMcpServer();
		await server.connect(transport);

		error("mobile-mcp server running on stdio");
	} catch (err: any) {
		error(`Fatal error in main(): ${formatFatalError(err)}`);
		process.exit(1);
	}
};

export const main = async () => {
	program
		.version(getAgentVersion())
		.option("--listen <listen>", "Start SSE server on [host:]port")
		.option("--stdio", "Start stdio server (default)")
		.parse(process.argv);

	const options = program.opts();

	if (options.listen) {
		const listen = (options.listen as string).trim();
		const lastColon = listen.lastIndexOf(":");
		let host = "localhost";
		let rawPort: string;

		if (lastColon > 0) {
			host = listen.substring(0, lastColon);
			rawPort = listen.substring(lastColon + 1);
		} else {
			rawPort = listen;
		}

		const port = Number.parseInt(rawPort, 10);
		if (!host || !rawPort || !Number.isInteger(port) || port < 1 || port > 65535) {
			error(`Invalid --listen value "${listen}". Expected [host:]port with port 1-65535.`);
			process.exit(1);
		}

		await startSseServer(host, port);
	} else {
		await startStdioServer();
	}
};

if (require.main === module) {
	main().catch((err: any) => {
		error(`Fatal error in main(): ${formatFatalError(err)}`);
		process.exit(1);
	});
}
