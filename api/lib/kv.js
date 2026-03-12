// api/lib/kv.js
// KV persistence abstraction for Signal Market
// Primary: Vercel KV (configured via env vars KV_REST_API_URL + KV_REST_API_TOKEN)
// Fallback: in-memory Map (resets on cold start — acceptable for demo)

const inMemory = new Map();

// Detect Vercel KV availability
const KV_AVAILABLE = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let kv = null;
if (KV_AVAILABLE) {
  // Dynamic import — only loaded when KV is configured
  // @vercel/kv is pre-installed on Vercel, no package.json change needed
  try {
    const { kv: vercelKV } = await import("@vercel/kv");
    kv = vercelKV;
  } catch {
    // Fall through to in-memory
  }
}

export const persistence = {
  mode: KV_AVAILABLE && kv ? "vercel_kv" : "in_memory",

  async get(key) {
    if (kv) return await kv.get(key);
    return inMemory.get(key) ?? null;
  },

  async set(key, value, options = {}) {
    if (kv) {
      if (options.ex) return await kv.set(key, value, { ex: options.ex });
      return await kv.set(key, value);
    }
    inMemory.set(key, value);
    return "OK";
  },

  async delete(key) {
    if (kv) return await kv.del(key);
    inMemory.delete(key);
    return 1;
  },

  async keys(pattern) {
    if (kv) return await kv.keys(pattern);
    const prefix = pattern.replace("*", "");
    return [...inMemory.keys()].filter(k => k.startsWith(prefix));
  },

  async hset(key, field, value) {
    if (kv) return await kv.hset(key, { [field]: value });
    const obj = inMemory.get(key) || {};
    obj[field] = value;
    inMemory.set(key, obj);
    return 1;
  },

  async hget(key, field) {
    if (kv) return await kv.hget(key, field);
    return (inMemory.get(key) || {})[field] ?? null;
  },

  async hgetall(key) {
    if (kv) return await kv.hgetall(key);
    return inMemory.get(key) || null;
  },

  async hdel(key, field) {
    if (kv) return await kv.hdel(key, field);
    const obj = inMemory.get(key) || {};
    delete obj[field];
    inMemory.set(key, obj);
    return 1;
  },
};

export default persistence;
