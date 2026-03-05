# UniverseLogs — Roblox Client

> Enterprise-grade logging client for Roblox. Asynchronous, buffered, failure-resilient, and highly observable.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Initialization (Constructor)](#initialization-constructor)
- [Configuration Reference](#configuration-reference)
- [API Methods](#api-methods)
  - [Core](#core)
  - [Level Shorthands](#level-shorthands)
  - [Read and Management](#read-and-management)
- [Internal Systems](#internal-systems)
  - [How the Buffer Works](#how-the-buffer-works)
  - [DataStore Fallback](#datastore-fallback)
  - [Throttling (Anti-Spam)](#throttling-anti-spam)
  - [Metadata Sanitization](#metadata-sanitization)
- [Advanced Use Cases](#advanced-use-cases)
- [Server Rate Limits](#server-rate-limits)

---

## Installation

1. Place the module (ModuleScript) in `ServerStorage` (or `ReplicatedStorage` if you prefer) and name it `UniverseLogs`.
2. In your game settings, enable HTTP requests (`Game Settings → Security → Allow HTTP Requests`).
3. If you use the data-loss safety system (DataStore Fallback), enable DataStore API access as well.

---

## Quick Start

The example below shows how to start the module and send your first server startup log.

```lua
local ServerStorage = game:GetService("ServerStorage")
local UniverseLogs = require(ServerStorage.UniverseLogs)

-- 1. Create the client
local ul = UniverseLogs.new("your-api-key-here", {
    baseUrl = "https://your-api.com",
    autoReportErrors = true,
})

-- 2. Initialize (required)
local ok, err = ul:init()
if not ok then
    warn("[UniverseLogs] Failed to initialize:", err)
    return
end

-- 3. Send a log
ul:info("Game server online and ready!", {
    topic = "boot",
    metadata = { 
        placeId = game.PlaceId, 
        jobId = game.JobId 
    }
})
```

---

## Initialization (Constructor)

```lua
UniverseLogs.new(apiKey: string, options?: Config): UniverseLogsInstance
```

Creates a new UniverseLogs client instance.

| Parameter | Type | Description |
|---|---|---|
| `apiKey` | `string` | **Required.** The API key for your Universe. |
| `options` | `Config?` | Optional. Table of options (see below). |

### Configuration Reference

All options are optional and have optimized defaults.

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `"https://api.universelogs.com"` | Base URL of your UniverseLogs API. |
| `localBufferCapacity` | `number` | `1000` | Max logs held in memory before forcing send to the server. |
| `autoFlush` | `boolean` | `true` | If `true`, batches logs. If `false`, sends HTTP on every call. |
| `flushInterval` | `number` | `5000` | Interval in ms to flush the buffer automatically. |
| `throttleWindow` | `number` | `5` | Cooldown (seconds) for the same log (level + message) to avoid spam. |
| `maxRetries` | `number` | `3` | Max retries on HTTP failure (exponential backoff). |
| `useDataStoreFallback` | `boolean` | `true` | If the API is down, stores logs in Roblox DataStore to send later. |
| `fallbackInterval` | `number` | `300` | Seconds between retries to send the DataStore queue. |
| `fallbackTTL` | `number` | `3600` | Seconds after which a stuck log in DataStore is considered dead and removed. |
| `fallbackMaxQueue` | `number` | `1000` | Max logs stored in DataStore. |
| `autoReportErrors` | `boolean` | `false` | If `true`, captures script errors (`ScriptContext.Error`) and sends as `error`. |
| `errorFilter` | `function?` | `nil` | `(message, stackTrace, script) -> boolean` to filter which errors to report. |
| `maxBulkSize` | `number` | `500` | Max logs in a single POST request. |
| `maxThrottleEntries` | `number` | `5000` | Max keys in the anti-spam cache. |

---

## API Methods

### Core

#### `ul:init()`
```lua
ul:init(): (boolean, string?)
```
Initializes background services. **Must be called before logging.**
* Runs API health check.
* Starts DataStore recovery loop (if enabled).
* Starts anti-spam cache cleanup.
* Sets up `game:BindToClose` to flush logs when the Roblox server shuts down.

Returns `true, nil` on success, or `false, "error message"`.

#### `ul:destroy()`
```lua
ul:destroy()
```
Stops background loops and synchronously flushes any remaining logs in memory.

#### `ul:log()`
```lua
ul:log(level: LogLevel, message: string, options?: LogOptions)
```
Main method. Validates, sanitizes, applies anti-spam, and enqueues the log.

| Parameter | Type | Description |
|---|---|---|
| `level` | `string` | Severity: `'trace' \| 'debug' \| 'info' \| 'warn' \| 'error' \| 'fatal'` |
| `message` | `string` | Log message. Max **2048 characters**. |
| `options.topic` | `string?` | Tag (e.g. "economy", "anticheat"). Max **100 characters**. |
| `options.metadata` | `any?` | Table or value for extra data. [Sanitized automatically](#metadata-sanitization). |
| `options.throttleKey` | `string?` | Custom key for anti-spam. Default is `"{level}:{message}"`. |

### Level Shorthands

Convenience methods that call `ul:log()` with a fixed level. All accept `(message: string, options?: LogOptions)`.

```lua
-- Very detailed flows and code tracing
ul:trace("Minigame loop started")

-- Development info
ul:debug("Generating map with seed", { metadata = { seed = 12345 } })

-- Normal operational events
ul:info("Player bought item in shop", { topic = "economy" })

-- Warnings that don't break the game but need attention
ul:warn("High memory usage detected", { topic = "performance" })

-- Errors from pcalls or system failures
ul:error("Failed to save player inventory", { topic = "datastore" })

-- Critical game failure
ul:fatal("Main database offline. Kicking players.", { topic = "core" })
```

### Read and Management

#### `ul:getLogs()`
```lua
ul:getLogs(filters?: QueryFilters): (boolean, { logs: LogEntry[], nextCursor: Cursor? }?)
```
Fetches logs from your server with filters and cursor-based pagination.

```lua
-- Example: Last 50 anticheat warnings
local ok, result = ul:getLogs({ level = "warn", topic = "anticheat", limit = 50 })

if ok and result then
    for _, log in ipairs(result.logs) do
        print(string.format("[%s] %s", log.timestamp, log.message))
    end
end
```

**Available filters:**
* `level` (string)
* `topic` (string)
* `limit` (number, default 20, max 100)
* `from` / `to` (ISO 8601 strings)
* `cursor_ts` / `cursor_id` (for pagination)

#### `ul:getLogsCount()`
```lua
ul:getLogsCount(filters?: { from: string?, to: string? }): (boolean, LogsCount?)
```
Returns total log count and count per level.

#### `ul:getLogById()`
```lua
ul:getLogById(id: string): (boolean, LogEntry?)
```
Fetches a single log by ID.

#### `ul:deleteLogs()`
```lua
ul:deleteLogs(params: { olderThan: string, level: string?, topic: string? }): (boolean, { deleted: number }?)
```
Permanently deletes logs older than the given date (`olderThan` in ISO 8601). Optionally filter by `level` or `topic`.

---

## Internal Systems

### How the Buffer Works

The client does not send a single HTTP request per log unless you disable `autoFlush`. Logs stay in memory (buffer) and are sent in bulk:

`ul:log() → [In-Memory Buffer] → (flush trigger) → POST /api/logs/bulk → UniverseLogs API`

**Flush happens when:**
1. The `flushInterval` timer hits 0 (every 5 seconds by default).
2. `localBufferCapacity` is reached (forces send to avoid memory growth).
3. The server shuts down (`game:BindToClose`). Code has about 5 seconds to drain the queue.
4. You call `ul:destroy()`.

### DataStore Fallback

If the API is down or Roblox HTTP fails, logs are not lost.

1. On HTTP failure, the queue is stored in DataStore `UniverseLogs_Fallback_v1`.
2. A background process retries sending that queue every `fallbackInterval` (5 minutes).
3. A distributed lock in DataStore `UniverseLogs_Lock_v1` ensures **only one game server** processes the queue at a time, avoiding duplicates.
4. Logs stuck longer than `fallbackTTL` (1 hour) are removed to avoid buildup.

### Throttling (Anti-Spam)

Loop-heavy code can accidentally send thousands of identical logs. UniverseLogs throttles by default.
* The exact same `message` at the same `level` is sent **at most once every 5 seconds** (`throttleWindow`).
* Extra occurrences are **dropped silently** on the client, saving network and database.

**Custom throttle key:** To limit identical messages **per player** instead of globally, pass a unique `throttleKey`:

```lua
ul:warn("Suspicious behavior (SpeedHack)", {
    throttleKey = "speedhack_" .. player.UserId,
    metadata = { userId = player.UserId }
})
```

### Metadata Sanitization

Luau tables can be complex (recursive Instances, deep metatables). UniverseLogs sanitizes `metadata` safely:

| Roblox Type | What is stored |
|---|---|
| `Vector3` | `"Vector3(1.00, 2.00, 3.00)"` |
| `CFrame` | `"CFrame(x, y, z)"` (position) |
| `Color3` | `"Color3(R=1.00, G=0.00, B=0.00)"` |
| `Instance (Player)` | `"Player(PlayerName, UserId=123)"` |
| `Instance (Base)` | `"Part("Door")"` |
| Large tables | Truncated after 64 keys |
| Circular refs | `"[Circular Reference]"` |

You don’t need to `JSONEncode` or worry about cycles. Pass the table in `metadata` as-is.

---

## Advanced Use Cases

### Automatic Error Capture with Filter
Useful for centralizing crash dashboards without noise from third-party errors.

```lua
local ul = UniverseLogs.new("KEY", {
    autoReportErrors = true,
    errorFilter = function(message, stackTrace, script)
        if script and script.Name == "Roact" then
            return false
        end
        return true
    end,
})
```

### Logging Server Join/Leave
Using `throttleKey` here prevents spam if a player exploit triggers Join/Leave repeatedly.

```lua
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    ul:info("Player joined the game", {
        topic = "players",
        throttleKey = "join:" .. player.UserId,
        metadata = {
            userId = player.UserId,
            accountAge = player.AccountAge
        }
    })
end)
```

---

## Server Rate Limits

The API enforces strict rate limits. When exceeded, it returns `HTTP 429 Too Many Requests`.

| Operation (Endpoint) | Limit per minute |
|---|---|
| Bulk create (`POST /api/logs/bulk`) | 20 calls |
| Single create (`POST /api/logs`) | 100 calls |
| List (`GET /api/logs`) | 120 calls |
| Count (`GET /api/logs/count`) | 120 calls |
| Single read (`GET /api/logs/:id`) | 60 calls |
| Delete (`DELETE /api/logs`) | 30 calls |

**Log size limits (enforced by API and client):**
* **Topic:** Max 100 characters.
* **Message:** Max 2048 characters.
* **Bulk size:** The client splits batches larger than `500` (configurable via `maxBulkSize`).

---

## ⚠️ Security and Responsibility

### SERVER-ONLY USE (ServerScriptService/ServerStorage)

**Never** place this module where the client can access it (`ReplicatedStorage`, `ReplicatedFirst`, `StarterPlayer`, etc.). The module contains your **API Key** in plain text and can write, read, and delete logs.

### Developer Responsibilities

By using this module you agree that:

1. **Credential protection:** You are responsible for keeping your `API Key` and `MASTER_KEY` secret. Do not expose them in client scripts, commit them to public repos, or share them with unauthorized parties.

2. **Client isolation:** The module must be used **only in server scripts**. If an exploiter gets your credentials (e.g. via ModuleScript in `ReplicatedStorage`), they can flood your database, delete all logs via `deleteLogs()`, or read sensitive log data.

3. **Policy compliance:** You must ensure data collected through this system complies with Roblox policies, LGPD (Brazil), GDPR (EU), COPPA (US), and other applicable laws. Do not log personally identifiable information (PII) without consent and proper safeguards.

4. **Cost monitoring:** High log volume can increase storage, compute, and network costs. Use retention policies (`deleteLogs`) and monitor usage.

5. **Testing:** Test integrations in development/staging before production. Handle rate limits, network failures, and unexpected behavior appropriately.

### Disclaimer

The author (`iamthebestts`) and contributors are **not liable** for data loss, financial harm, policy violations, downtime, bugs, or misuse. This software is provided **"AS IS"** without warranties. You assume all risks.

---

## 📜 MIT License

Copyright © 2026 iamthebestts

See the `LICENSE` file in the repository for the full text.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/iamthebestts">iamthebestts</a></p>
  <p><strong>Use responsibly. Protect your credentials. Stay secure.</strong></p>
</div>
