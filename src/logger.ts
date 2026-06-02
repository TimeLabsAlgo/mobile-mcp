import { appendFileSync } from "node:fs";

const SENSITIVE_VALUE = "[redacted]";

export const sanitizeForLog = (value: unknown): string => {
	if (value === undefined) {
		return "undefined";
	}

	const text = typeof value === "string" ? value : JSON.stringify(value);
	if (!text) {
		return "";
	}

	return text
		.replace(/("?(?:authorization)"?\s*[:=]\s*)(?:Bearer\s+)?("[^"]*"|[A-Za-z0-9._~+/-]+=*)/gi, `$1"${SENSITIVE_VALUE}"`)
		.replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${SENSITIVE_VALUE}`)
		.replace(/("?(?:text|password|passcode|token|authorization|api[_-]?key|secret|content|data)"?\s*[:=]\s*)("[^"]*"|[^\s,}]+)/gi, `$1"${SENSITIVE_VALUE}"`)
		.replace(/(https?:\/\/)[^\s"]+/gi, `$1${SENSITIVE_VALUE}`);
};

const writeLog = (message: string) => {
	const safeMessage = sanitizeForLog(message);
	if (process.env.LOG_FILE) {
		const logfile = process.env.LOG_FILE;
		const timestamp = new Date().toISOString();
		const levelStr = "INFO";
		const logMessage = `[${timestamp}] ${levelStr} ${safeMessage}`;
		appendFileSync(logfile, logMessage + "\n");
	}

	console.error(safeMessage);
};

export const trace = (message: string) => {
	writeLog(message);
};

export const error = (message: string) => {
	writeLog(message);
};
