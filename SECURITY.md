# Security and Responsibility Policy

## 🔒 Overview

**UniverseLogs** is a powerful observability tool that, if misconfigured, can expose sensitive data or allow attacks on your log system. This document defines mandatory security guidelines and clarifies end-user responsibilities.

**Versão em português (pt-BR):** [Política de Segurança](pt-br/SECURITY.md)

---

## ⚠️ CRITICAL: SERVER-SIDE USE ONLY

### ❌ NEVER do this

```lua
-- ❌ WRONG: Instantiating the module in a LocalScript (client-side)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UniverseLogs = require(ReplicatedStorage.UniverseLogs)

-- This exposes your API Key to the client!
local ul = UniverseLogs.new("your-secret-api-key", {...})
```

### ✅ ALWAYS do this

```lua
-- ✅ CORRECT: Instantiate only in server Scripts (server-side)
local ServerStorage = game:GetService("ServerStorage")
local UniverseLogs = require(ServerStorage.UniverseLogs)

local ul = UniverseLogs.new("your-secret-api-key", {...})
```

**Why?** The module holds your **API Key in plain text** in the code that creates the client. If you call `UniverseLogs.new()` from a **LocalScript** (client-side):

1. **The API Key becomes visible to exploiters** via decompilers and script injection tools.
2. An attacker can extract the key and use it outside the game to:
   - **Flood your database** with millions of fake logs, driving up storage and processing costs.
   - **Delete all history** via the `deleteLogs()` method.
   - **Extract confidential data** from logs (player data, economy, anti-cheat logic).

### ⚠️ Important Clarification

**Where the ModuleScript lives does not matter** (`ServerStorage`, `ReplicatedStorage`, etc.). What matters is **where you call `UniverseLogs.new()` with the API Key**:

- ✅ **Safe:** Calling from a server `Script` (e.g. `ServerScriptService`, `Workspace`)
- ❌ **UNSAFE:** Calling from a `LocalScript` (e.g. `StarterPlayer`, `StarterGui`, `ReplicatedFirst`)

**Golden rule:** The API Key must **never** exist or be processed on the client. Always instantiate the module on the server.

---

## 🔑 Credential Protection

### API Keys and Master Keys

Access keys are the “passwords” of your log system. **Never:**

- ❌ Commit `.env` files or hardcoded keys to public repositories.
- ❌ Share keys on Discord, forums, or support tickets.
- ❌ Reuse keys between development and production.
- ❌ Store keys in plain text in versioned config files.
- ❌ **Instantiate the module with the API Key in LocalScripts (client-side).**

### Best Practices

- ✅ Use environment variables (`.env`) and add `.env` to `.gitignore`.
- ✅ Rotate compromised keys immediately via `/internal/keys/revoke`.
- ✅ Use separate keys for development, staging, and production.
- ✅ Monitor for anomalous usage (e.g. sudden request spikes).
- ✅ **Always instantiate the module in server scripts (server-side).**

---

## 🛡️ Security of Collected Data

### Legal Compliance

You are **legally responsible** for ensuring collected data complies with:

- **LGPD** (Brazil): Lei Geral de Proteção de Dados Pessoais
- **GDPR** (EU): General Data Protection Regulation
- **COPPA** (US): Children's Online Privacy Protection Act
- **Roblox policies:** [Roblox Terms of Use](https://en.help.roblox.com/hc/en-us/articles/115004647846)

### What NOT to Log

❌ **Personally identifiable information (PII) without explicit consent:**

- Full IP addresses
- Real names
- Emails, phone numbers
- Precise geographic location
- Financial details (except generic transaction IDs)

### What to Log Safely

✅ **Anonymized or pseudonymized data:**

- Roblox `UserId` (platform identifier, not direct PII)
- Event timestamps
- Gameplay actions (e.g. “item purchased”, “level completed”)
- Technical errors (stack traces without sensitive data)

---

## 💰 Cost and Resource Management

### Volume Monitoring

High log volume can lead to significant cost:

- **Storage:** PostgreSQL, backups, long retention.
- **Compute:** Batch processing, complex queries.
- **Network:** HTTP traffic between Roblox and your server.

### Recommendations

1. **Configure automatic retention:**

   ```lua
   -- Delete logs older than 30 days
   ul:deleteLogs({
       olderThan = os.date("!%Y-%m-%dT%H:%M:%SZ", os.time() - 30*24*60*60)
   })
   ```

2. **Use `topic` to categorize and filter:**
   - Keep critical logs (`topic = "security"`) longer.
   - Discard debug logs (`topic = "dev"`) quickly.

3. **Monitor metrics regularly:**

   ```lua
   local ok, count = ul:getLogsCount()
   if ok and count.total > 1000000 then
       warn("⚠️ Logs exceeding 1M. Consider cleanup.")
   end
   ```

---

## 🚨 Reporting Vulnerabilities

If you find a security vulnerability in this project, **do not** open a public GitHub Issue.

### Responsible Disclosure

1. Send a detailed email to: **<githubissues.tremor737@passinbox.com>** *(or create a GitHub Security Advisory)*
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. Expect acknowledgment within 48 hours.
4. Wait for the patch to be published before disclosing publicly.

---

## 📋 Developer Responsibilities (You)

By using UniverseLogs, you acknowledge that you are **fully responsible** for:

### 1. Configuration and Deployment

- Ensuring the module is instantiated **only in server-side scripts**.
- Protecting credentials from leakage.
- Configuring rate limits and throttling appropriately.

### 2. Legal Compliance

- Complying with applicable data protection laws (LGPD, GDPR, COPPA).
- Obtaining consent for data collection when required.
- Implementing clear privacy policies.

### 3. Monitoring and Maintenance

- Monitoring storage and traffic costs.
- Implementing data retention policies.
- Investigating and responding to security incidents.

### 4. Risk Management

- Running security tests before production deploy.
- Implementing backups and disaster recovery.
- Training the team on security and compliance practices.

---

## 🚫 Disclaimer

### The author (`iamthebestts`) and contributors ARE NOT LIABLE FOR

- ❌ Loss, leakage, corruption, or theft of data.
- ❌ Financial harm (storage costs, regulatory fines, etc.).
- ❌ Breach of Roblox policies or data protection laws.
- ❌ Downtime, bugs, security failures, or unexpected behavior.
- ❌ Cyber attacks due to misconfiguration or exposed credentials.
- ❌ Misuse by third parties (exploiters, attackers, competitors).

### "AS IS" Clause

This software is distributed **"AS IS"**, without warranties of any kind, express or implied, including but not limited to:

- Merchantability
- Fitness for a particular purpose
- Non-infringement
- Security, reliability, or accuracy

**You assume ALL risks associated with using this software.**

---

## ✅ Pre-Deploy Security Checklist

Before running UniverseLogs in production, verify:

- [ ] The module is instantiated **only in server scripts** (never in LocalScripts).
- [ ] The **API Key** is never exposed to the client.
- [ ] The backend **MASTER_KEY** is at least 32 random characters.
- [ ] Rate limits are configured on the backend (`rateLimitHandler`).
- [ ] Data retention is in place (e.g. delete logs older than 90 days).
- [ ] Logs do not contain unconsented PII (real names, emails, full IPs).
- [ ] Regular PostgreSQL backups are configured.
- [ ] Cost and anomaly alerts are enabled.
- [ ] Load tests have been run to validate throughput limits.
- [ ] The team has been trained on security and compliance practices.

---

## 📞 Contact

For critical security matters, **do not use public Issues**. Contact via:

- **GitHub Security Advisory:** [Create private advisory](https://github.com/iamthebestts/UniverseLogs/security/advisories/new)
- **Nexo+ Discord:** [https://discord.gg/EPucmXpDQR](https://discord.gg/EPucmXpDQR) (channel `#atendimento`)

---

## 📜 License

This document is part of the **UniverseLogs** project and is subject to the [MIT License](./LICENSE).

**Use wisely. Protect your credentials. Keep your users safe.**

---

<div align="center">
  <p><strong>Security is not a feature. It is a responsibility.</strong></p>
</div>
