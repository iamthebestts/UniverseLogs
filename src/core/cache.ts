type CacheEntry<T> = {
    value: T
    expiresAt: number
}

type SetOptions = {
    ttl?: number
}

type LRUNode = {
    prev: string | null
    next: string | null
}

/**
 * High-performance in-memory cache with TTL, LRU eviction and size limits.
 * Designed as a high-performance local (L1) cache, complementary to Redis.
 */
export class MemoryCache<T> {
    private cache = new Map<string, CacheEntry<T>>()
    private lruNodes = new Map<string, LRUNode>()
    private head: string | null = null
    private tail: string | null = null
    private cleanupTimer: ReturnType<typeof setTimeout> | null = null
    private pendingPromises = new Map<string, Promise<T>>()
    private insertCount = 0
    private stats_data = {
        hits: 0,
        misses: 0,
        evictions: 0,
        expirations: 0,
    }

    /**
     * Creates a new MemoryCache instance.
     * @param defaultTTL - Default time-to-live in milliseconds (default: 60000)
     * @param maxSize - Maximum number of entries (must be > 0, default: 1000)
     * @param enableCleanupTimer - Enable automatic cleanup timer (default: true)
     * @param evictionBatchSize - Number of entries to evict at once when full (default: 1)
     * @throws Error if maxSize is <= 0
     */
    constructor(
        private defaultTTL = 60_000,
        private maxSize = 1000,
        private enableCleanupTimer = true,
        private evictionBatchSize = 1,
    ) {
        // Enforce maxSize > 0 to prevent unbounded cache growth
        if (maxSize <= 0) {
            throw new Error(
                `maxSize must be greater than 0, got ${maxSize}. Cache requires at least 1 entry capacity.`,
            )
        }
    }

    /**
     * Sets a value in the cache with optional TTL.
     * @param key - The cache key
     * @param value - The value to store
     * @param options - Optional settings including TTL
     * @returns The cache instance for method chaining
     */
    set(key: string, value: T, options: SetOptions = {}): this {
        const expiresAt = Date.now() + (options.ttl ?? this.defaultTTL)

        if (this.cache.has(key)) {
            this.cache.set(key, { value, expiresAt })
            this.moveToHead(key)
        } else {
            this.insertCount++
            // Periodic cleanup every 50 inserts to remove expired items proactively
            if (this.insertCount % 50 === 0) {
                this.evictExpired()
            }

            // Enforce maxSize strictly
            if (this.cache.size >= this.maxSize) {
                this.evictExpired() // Try to make space by removing expired first

                // If still full, evict LRU until we are below limit
                while (this.cache.size >= this.maxSize) {
                    const evicted = this.evictLRU()
                    if (evicted === 0) break // Safety break
                }
            }

            this.cache.set(key, { value, expiresAt })
            this.addToHead(key)
        }

        if (this.enableCleanupTimer) {
            this.scheduleCleanup()
        }
        return this
    }

    /**
     * Sets multiple values in the cache with optional TTL.
     * @param entries - Array of key-value pairs to set
     * @param options - Optional settings including TTL
     * @returns The cache instance for method chaining
     */
    setMany(entries: Array<[string, T]>, options: SetOptions = {}): this {
        for (const [key, value] of entries) {
            this.set(key, value, options)
        }
        return this
    }

    /**
     * Retrieves a value from the cache.
     * @param key - The cache key
     * @returns The cached value or null if not found/expired
     */
    get(key: string): T | null {
        // Cleanup expired entries if timer is disabled
        if (!this.enableCleanupTimer && Math.random() < 0.1) {
            // 10% chance to cleanup on each get
            this.cleanupExpired()
        }

        const entry = this.cache.get(key)
        if (!entry) {
            this.stats_data.misses++
            return null
        }

        if (Date.now() > entry.expiresAt) {
            this.stats_data.expirations++
            this.delete(key)
            return null
        }

        this.stats_data.hits++
        this.moveToHead(key)
        return entry.value
    }

    /**
     * Gets multiple values at once (batch operation)
     * @param keys - Array of cache keys
     * @returns Map of found key-value pairs
     */
    getMany(keys: string[]): Map<string, T> {
        const result = new Map<string, T>()
        for (const key of keys) {
            const value = this.get(key)
            if (value !== null) result.set(key, value)
        }
        return result
    }

    /**
     * Checks if a key exists and is not expired.
     * Note: This method updates LRU order.
     * @param key - The cache key
     * @returns True if key exists and is valid
     */
    has(key: string): boolean {
        return this.get(key) !== null
    }

    /**
     * Checks if multiple keys exist and are not expired.
     * @param keys - The cache keys to check
     * @returns A map of key-value pairs for the found keys
     */
    hasMany(keys: string[]): Map<string, boolean> {
        const result = new Map<string, boolean>()
        for (const key of keys) {
            result.set(key, this.peek(key))
        }
        return result
    }

    /**
     * Checks if a key exists without updating LRU order.
     * @param key - The cache key
     * @returns True if key exists and is valid
     */
    peek(key: string): boolean {
        const entry = this.cache.get(key)
        if (!entry) return false
        return Date.now() <= entry.expiresAt
    }

    /**
     * Peek multiple keys from the cache.
     * @param keys - The cache keys to peek
     * @returns A map of key-value pairs for the found keys
     */
    peekMany(keys: string[]): Map<string, T> {
        const result = new Map<string, T>()
        const now = Date.now()

        for (const key of keys) {
            const entry = this.cache.get(key)
            if (!entry) continue

            if (entry.expiresAt <= now) {
                this.delete(key)
                continue
            }

            result.set(key, entry.value)
        }

        return result
    }

    /**
     * Removes a key from the cache.
     * @param key - The cache key to remove
     */
    delete(key: string): void {
        if (!this.cache.has(key)) return

        this.cache.delete(key)
        this.removeFromLRU(key)
    }

    /**
     * Removes keys from the cache.
     * @param keys - Array of cache keys to remove.
     */
    deleteMany(keys: string[]): void {
        for (const key of keys) {
            if (!this.has(key)) continue
            this.cache.delete(key)
            this.removeFromLRU(key)
        }
    }

    /**
     * Evicts expired entries from the cache.
     * @returns Number of entries evicted
     */
    private evictExpired(): number {
        const now = Date.now()
        let evicted = 0

        for (const [key, entry] of this.cache) {
            if (entry.expiresAt <= now) {
                this.cache.delete(key)
                this.removeFromLRU(key)
                this.stats_data.expirations++
                evicted++
            }
        }

        return evicted
    }

    /**
     * Gets a value or computes it if missing (read-through cache)
     * @param key - Cache key
     * @param factory - Function to compute value if missing
     * @param options - Optional TTL settings
     */
    async getOrSet(
        key: string,
        factory: () => T | Promise<T>,
        options: SetOptions = {},
    ): Promise<T> {
        const existing = this.get(key)
        if (existing !== null) return existing

        const pending = this.pendingPromises.get(key)
        if (pending) return pending

        const promise = (async () => {
            try {
                // Wrap factory in a race with timeout to ensure cleanup prevents memory leak
                const factoryPromise = Promise.resolve(factory())
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(new Error("Cache factory timeout")),
                        30000,
                    ),
                )

                const value = await Promise.race([
                    factoryPromise,
                    timeoutPromise,
                ])
                this.set(key, value, options)
                return value
            } finally {
                this.pendingPromises.delete(key)
            }
        })()

        this.pendingPromises.set(key, promise)
        // Ensure we catch the error if the caller doesn't, to prevent unhandled rejection
        // associated with the stored promise if the caller ignores it.
        promise.catch(() => { })

        return promise
    }

    /**
     * Updates TTL of an existing entry without changing value
     * @param key - Cache key
     * @param ttl - New TTL in milliseconds
     */
    touch(key: string, ttl?: number): boolean {
        const entry = this.cache.get(key)
        if (!entry) return false

        entry.expiresAt = Date.now() + (ttl ?? this.defaultTTL)
        this.moveToHead(key)
        return true
    }

    /**
     * Gets remaining TTL for a key
     * @param key - Cache key
     * @returns Remaining milliseconds or null if not found/expired
     */
    ttl(key: string): number | null {
        const entry = this.cache.get(key)
        if (!entry) return null

        const remaining = entry.expiresAt - Date.now()
        return remaining > 0 ? remaining : null
    }

    /**
     * Gets all values (without keys)
     * @returns Array of all cached values
     */
    values(): T[] {
        const now = Date.now()
        return Array.from(this.cache.entries())
            .filter(([_, entry]) => entry.expiresAt > now)
            .map(([_, entry]) => entry.value)
    }

    /**
     * Gets all entries as key-value pairs
     * @returns Array of [key, value] tuples
     */
    entries(): Array<[string, T]> {
        const now = Date.now()
        return Array.from(this.cache.entries())
            .filter(([_, entry]) => entry.expiresAt > now)
            .map(([key, entry]) => [key, entry.value])
    }

    /**
     * Increment a numeric value (atomic operation)
     * @param key - Cache key
     * @param delta - Amount to increment (default: 1)
     */
    increment(key: string, delta = 1): number | null {
        const value = this.get(key)
        if (typeof value !== "number") return null

        const entry = this.cache.get(key)
        if (!entry) return null

        const newValue = value + delta
        this.cache.set(key, {
            value: newValue as T,
            expiresAt: entry.expiresAt,
        })

        return newValue
    }

    /**
     * Decrement a numeric value (atomic operation)
     * @param key - Cache key
     * @param delta - Amount to decrement (default: 1)
     */
    decrement(key: string, delta = 1): number | null {
        return this.increment(key, -delta)
    }

    /**
     * Checks if cache contains any entries matching a pattern
     * WARNING: O(n) operation - use sparingly on large caches
     * @param pattern - RegExp or string pattern (supports wildcards *)
     */
    scan(pattern: string | RegExp): string[] {
        const MAX_PATTERN_LENGTH = 256
        const escapeRegExp = (value: string) =>
            value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

        let regex: RegExp | null = null

        try {
            if (typeof pattern === "string") {
                if (pattern.length > MAX_PATTERN_LENGTH) return []
                const escaped = escapeRegExp(pattern).replace(/\\\*/g, ".*")
                regex = new RegExp(`^${escaped}$`)
            } else {
                if (pattern.source.length > MAX_PATTERN_LENGTH) return []
                regex = pattern
            }
        } catch {
            return []
        }

        try {
            return this.keys().filter((key) => regex!.test(key))
        } catch {
            return []
        }
    }

    /**
     * Deletes all keys matching a pattern
     * @param pattern - RegExp or string pattern
     */
    deletePattern(pattern: string | RegExp): number {
        const keys = this.scan(pattern)
        this.deleteMany(keys)
        return keys.length
    }

    /**
     * Clears all entries from the cache.
     */
    clear(): void {
        this.cache.clear()
        this.lruNodes.clear()
        this.pendingPromises.clear()
        this.head = null
        this.tail = null
        this.insertCount = 0
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer)
            this.cleanupTimer = null
        }
    }

    /**
     * Gets the current number of entries in the cache.
     * @returns The number of cached entries
     */
    size(): number {
        return this.cache.size
    }

    /**
     * Gets all cache keys.
     * @returns Array of all cache keys
     */
    keys(): string[] {
        return Array.from(this.cache.keys())
    }

    /**
     * Gets cache statistics including performance metrics.
     * @returns Object with cache statistics and performance data
     */
    stats(): {
        size: number
        maxSize: number
        defaultTTL: number
        hits: number
        misses: number
        evictions: number
        expirations: number
        hitRate: number
        cleanupTimerEnabled: boolean
        evictionBatchSize: number
    } {
        const totalRequests = this.stats_data.hits + this.stats_data.misses
        const hitRate =
            totalRequests > 0 ? this.stats_data.hits / totalRequests : 0

        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            hits: this.stats_data.hits,
            misses: this.stats_data.misses,
            evictions: this.stats_data.evictions,
            expirations: this.stats_data.expirations,
            hitRate: Number(hitRate.toFixed(4)),
            cleanupTimerEnabled: this.enableCleanupTimer,
            evictionBatchSize: this.evictionBatchSize,
        }
    }

    /**
     * Resets cache statistics counters.
     */
    resetStats(): void {
        this.stats_data = {
            hits: 0,
            misses: 0,
            evictions: 0,
            expirations: 0,
        }
    }

    /**
     * Destroys the cache and cleans up resources.
     */
    destroy(): void {
        // Limpar timer de cleanup para evitar memory leak
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer)
            this.cleanupTimer = null
        }
        this.clear()
    }

    private addToHead(key: string): void {
        const node: LRUNode = { prev: null, next: this.head }
        this.lruNodes.set(key, node)

        if (this.head) {
            const headNode = this.lruNodes.get(this.head)
            if (headNode) headNode.prev = key
        }

        this.head = key
        if (!this.tail) this.tail = key
    }

    private removeFromLRU(key: string): void {
        const node = this.lruNodes.get(key)
        if (!node) return

        if (node.prev) {
            const prevNode = this.lruNodes.get(node.prev)
            if (prevNode) prevNode.next = node.next
        } else {
            this.head = node.next
        }

        if (node.next) {
            const nextNode = this.lruNodes.get(node.next)
            if (nextNode) nextNode.prev = node.prev
        } else {
            this.tail = node.prev
        }

        this.lruNodes.delete(key)
    }

    private moveToHead(key: string): void {
        if (this.head === key) return

        this.removeFromLRU(key)
        this.addToHead(key)
    }

    /**
     * Evicts LRU entries in batch.
     * @returns Number of entries evicted
     */
    private evictLRU(): number {
        let evicted = 0
        const itemsToEvict = Math.max(1, this.cache.size - this.maxSize + 1)
        const batch = Math.max(this.evictionBatchSize, itemsToEvict)

        const toEvict = Math.min(batch, this.cache.size)

        for (let i = 0; i < toEvict && this.tail; i++) {
            const tailKey = this.tail
            this.cache.delete(tailKey)
            this.removeFromLRU(tailKey)
            this.stats_data.evictions++
            evicted++
        }

        return evicted
    }

    /**
     * Manually triggers cleanup of expired entries.
     * Useful when cleanup timer is disabled.
     * @returns Number of entries cleaned up
     */
    cleanup(): number {
        const sizeBefore = this.cache.size
        this.cleanupExpired()
        return sizeBefore - this.cache.size
    }

    getDefaultTTL(): number {
        return this.defaultTTL
    }

    private scheduleCleanup(): void {
        if (!this.enableCleanupTimer) return

        if (this.cleanupTimer) clearTimeout(this.cleanupTimer)

        let nextExpire = Infinity
        for (const entry of this.cache.values()) {
            if (entry.expiresAt < nextExpire) {
                nextExpire = entry.expiresAt
            }
        }

        if (nextExpire === Infinity) return

        const delay = Math.max(0, nextExpire - Date.now())

        const finalDelay = delay < 100 ? 0 : delay

        this.cleanupTimer = setTimeout(() => {
            this.cleanupExpired()
            if (this.cache.size > 0) {
                setTimeout(() => this.scheduleCleanup(), 10)
            }
        }, finalDelay)
    }

    private cleanupExpired(): void {
        const now = Date.now()
        for (const [key, entry] of this.cache) {
            if (entry.expiresAt <= now) {
                this.delete(key)
            }
        }
    }
}
