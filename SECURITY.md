# Security Policy

## Supported Versions

All versions of this project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| All     | :white_check_mark: |

## Important notes regarding use of mobile-mcp

**mobile-mcp** is an MCP server for controlling a mobile device. Device may be a real iOS device, real Android device, an iOS Simulator or Android
Emulator.

You may use mobile-mcp for various tasks, such as app development, marketing automation, quality assurance and so on.

As a rule of thumb, verify which tools your Agent is invoking. It has access to the device or simulator, it may operate the device to the security
scope of that device. It is suggested that you use a device that is purposed for this use.

For private security testing:

- Use the default stdio transport or localhost-only SSE whenever possible.
- If you bind SSE to a non-localhost interface, set `MOBILEMCP_AUTH` to require Bearer token authorization.
- Logs are intended to avoid typed text, authorization values, tool arguments, and tool responses by default. Do not enable verbose logging in environments where device screens, crash reports, or typed values may be sensitive.
- Treat `MOBILECLI_PATH`, `GO_IOS_PATH`, and platform SDK paths as trusted configuration. They control which local executables Mobile MCP invokes.
- Use dedicated test devices, simulators, or emulators without production accounts for untrusted agent workflows.

## Reporting a Vulnerability

To report a security vulnerability, please join our Slack channel at http://mobilenexthq.com/join-slack and DM the moderators with details of the vulnerability.

We take all security reports seriously and will respond as quickly as possible.

