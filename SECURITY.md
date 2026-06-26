# Security Policy

## Threat Model

Tanzo is a local-first AI desktop application that, by design, **executes arbitrary shell commands**
and **reads/writes files in your workspace** under the direction of an AI agent. This capability is
core to its functionality, but it introduces significant risk if used with:

- **Untrusted workspaces** (e.g., cloned repositories you have not reviewed)
- **Malicious or compromised prompts** (including workspace instructions, MCP server outputs, or hook
  payloads that attempt prompt injection)
- **Public or shared environments** where other users can modify workspace files

### Security Boundaries

Tanzo enforces the following protections:

1. **Workspace confinement**: File reads and writes are restricted to the workspace directory. Symlink
   traversal outside the workspace is blocked. See `src/main/agent/fs/workspace-fs.ts`.

2. **Credential-path blocking**: The agent cannot read or write paths matching `.ssh/`, `.aws/`,
   `.env`, `.env.*`, or `.envrc` patterns. See `src/main/agent/security/path-safety.ts`.

3. **Environment variable stripping**: Shell commands run with a sanitized environment where keys
   matching `API_KEY`, `SECRET`, `TOKEN`, `PASSWORD`, and other sensitive patterns are removed. See
   `src/main/safe-env.ts`.

4. **Electron security baseline**: All renderer processes run with `contextIsolation: true`,
   `nodeIntegration: false`, and `sandbox: true`. External navigation is intercepted and opened in
   the system browser. See `src/main/window.ts` and `src/main/pet-window.ts`.

5. **Credential storage**: AI provider secrets are stored using the OS secure store via Electron
   `safeStorage` and never written to disk in plain text (unless the user explicitly opts in). See
   `src/main/provider/secret.ts`.

6. **Approval system**: Sensitive tool calls can be gated by a policy engine with configurable
   permission modes. See `docs/architecture/13-policy-and-approval.md`.

### What Tanzo Cannot Protect Against

- **Malicious shell commands the user approves**: If the agent requests `rm -rf /` and you approve it,
  Tanzo will execute it. Review tool calls carefully.
- **Workspace instruction poisoning**: If a malicious actor commits a `.tanzo-workflow-plan.md` or
  similar instruction file that tricks the agent into exfiltrating data or running destructive
  commands, the agent will follow those instructions. **Only open trusted workspaces.**
- **Compromised MCP servers or hooks**: Subprocess hooks and MCP servers run with the user's
  privileges and can emit arbitrary data that may attempt prompt injection. Only install hooks and MCP
  servers you trust.

## Reporting a Vulnerability

If you discover a security vulnerability in Tanzo, please **do not open a public issue**. Instead:

1. Use GitHub private vulnerability reporting if it is enabled for this repository. If not, email
   `f4tumnigrum@gmail.com` with:
   - A clear description of the vulnerability.
   - Steps to reproduce (if applicable).
   - Any suggested mitigations.

2. We will acknowledge your report within **48 hours** and provide an expected timeline for a fix.

3. We will coordinate a disclosure timeline with you and credit you in release notes (unless you
   prefer to remain anonymous).

## Supported Versions

Security patches are applied to the latest release. We do not backport security fixes to older
versions at this time.

## Additional Resources

- [Architecture Documentation](./docs/README.md)
- [12 Tools System](./docs/architecture/12-tools.md) — details on the shell and file tool sandboxes
- [13 Policy and Approval](./docs/architecture/13-policy-and-approval.md) — approval rules and
  permission modes
