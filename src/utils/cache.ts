// A simple in-memory cache for demonstration purposes.
// In a production environment, consider using Redis or a dedicated caching solution.

interface CacheEntry<T> {
  value: T
  expiry: number // Unix timestamp in milliseconds
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>()

  /**
   * Sets a value in the cache with an optional time-to-live (TTL).
   * @param key The key to store the value under.
   * @param value The value to store.
   * @param ttlSeconds The time-to-live for the entry in seconds. Defaults to 300 seconds (5 minutes).
   */
  set<T>(key: string, value: T, ttlSeconds = 300): void {
    if (ttlSeconds <= 0) {
      // If TTL is 0 or negative, effectively don't cache or immediately expire
      this.delete(key)
      return
    }
    const expiry = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiry })
    this.scheduleCleanup(key, ttlSeconds * 1000)
  }

  /**
   * Retrieves a value from the cache. Returns undefined if the key does not exist or has expired.
   * @param key The key of the value to retrieve.
   * @returns The cached value, or undefined.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    if (Date.now() > entry.expiry) {
      this.delete(key) // Remove expired entry
      return undefined
    }

    return entry.value as T
  }

  /**
   * Deletes an entry from the cache.
   * @param key The key of the entry to delete.
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clears all entries from the cache.
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Schedules the deletion of an entry after its TTL.
   * @param key The key of the entry to schedule for cleanup.
   * @param delayMs The delay in milliseconds before the entry is deleted.
   */
  private scheduleCleanup(key: string, delayMs: number): void {
    setTimeout(() => {
      // Check again if the entry still exists and is expired (in case it was updated)
      const entry = this.cache.get(key)
      if (entry && Date.now() >= entry.expiry) {
        this.delete(key)
      }
    }, delayMs)
  }
}

export const loanDecisionCache = new InMemoryCache()
