// api/lib/kv.js — KV persistence abstraction
// Primary: Vercel KV (env: KV_REST_API_URL + KV_REST_API_TOKEN)
// Fallback: in-memory Map (cold-start reset, acceptable for demo)
// NOTE: @vercel/kv uses @upstash/redis under the hood — must be in package.json

const inMemory = new Map();
const KV_AVAILABLE = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let _kv = null;
async function getKV() {
  if (!KV_AVAILABLE) return null;
  if (_kv) return _kv;
  try {
    const mod = await import("@vercel/kv");
    _kv = mod.kv;
    return _kv;
  } catch {
    return null;
  }
}

export const persistence = {
  get mode() { return KV_AVAILABLE ? "vercel_kv" : "in_memory"; },

  async get(key) {
    const kv = await getKV();
    if (kv) return await kv.get(key);
    return inMemory.get(key) ?? null;
  },
  async set(key, value, opts = {}) {
    const kv = await getKV();
    if (kv) return opts.ex ? await kv.set(key, value, { ex: opts.ex }) : await kv.set(key, value);
    inMemory.set(key, value);
    return "OK";
  },
  async delete(key) {
    const kv = await getKV();
    if (kv) return await kv.del(key);
    inMemory.delete(key); return 1;
  },
  async keys(pattern) {
    const kv = await getKV();
    if (kv) return await kv.keys(pattern);
    const prefix = pattern.replace(/\*.*$/, "");
    return [...inMemory.keys()].filter(k => k.startsWith(prefix));
  },
  async hset(key, field, value) {
    const kv = await getKV();
    if (kv) return await kv.hset(key, { [field]: value });
    const obj = inMemory.get(key) || {}; obj[field] = value; inMemory.set(key, obj); return 1;
  },
  async hget(key, field) {
    const kv = await getKV();
    if (kv) return await kv.hget(key, field);
    return (inMemory.get(key) || {})[field] ?? null;
  },
  async hgetall(key) {
    const kv = await getKV();
    if (kv) return await kv.hgetall(key);
    return inMemory.get(key) || null;
  },
  async hdel(key, field) {
    const kv = await getKV();
    if (kv) return await kv.hdel(key, field);
    const obj = inMemory.get(key) || {}; delete obj[field]; inMemory.set(key, obj); return 1;
  },
};

export default persistence;
