const fs = require("node:fs");
const path = require("node:path");

const binPath = path.join(__dirname, "..", "lib", "index.js");

if (process.platform !== "win32") {
	fs.chmodSync(binPath, 0o755);
}
