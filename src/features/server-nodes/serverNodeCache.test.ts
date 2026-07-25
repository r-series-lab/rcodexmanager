import { beforeEach, describe, expect, it } from "vitest";
import {
  clearServerNodeCache,
  clearServerNodeCacheForNode,
  readServerNodeCache,
  SERVER_NODE_CACHE_TTL_MS,
  serverNodeCacheKey,
  writeServerNodeCache,
} from "./serverNodeCache";

describe("serverNodeCache", () => {
  beforeEach(() => clearServerNodeCache());

  it("returns fresh data inside the TTL and stale data after it", () => {
    const key = serverNodeCacheKey("node-a", "profiles");
    writeServerNodeCache(key, { count: 4 }, 1_000);
    expect(readServerNodeCache<{ count: number }>(key, 1_000 + SERVER_NODE_CACHE_TTL_MS - 1)).toMatchObject({
      data: { count: 4 },
      fresh: true,
    });
    expect(readServerNodeCache(key, 1_000 + SERVER_NODE_CACHE_TTL_MS)?.fresh).toBe(false);
  });

  it("isolates variants and clears only one node", () => {
    const first = serverNodeCacheKey("node-a", "sessions", "page-1");
    const second = serverNodeCacheKey("node-a", "sessions", "page-2");
    const other = serverNodeCacheKey("node-b", "sessions", "page-1");
    writeServerNodeCache(first, [1]);
    writeServerNodeCache(second, [2]);
    writeServerNodeCache(other, [3]);
    clearServerNodeCacheForNode("node-a");
    expect(readServerNodeCache(first)).toBeNull();
    expect(readServerNodeCache(second)).toBeNull();
    expect(readServerNodeCache(other)?.data).toEqual([3]);
  });
});
