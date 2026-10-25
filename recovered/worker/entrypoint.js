import {createBankProfileHandlers} from './bank-profile.mjs';
var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/errors.js
var ApiError = class extends Error {
  static {
    __name(this, "ApiError");
  }
  constructor(code, message, status = statusForCode(code)) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
};
function statusForCode(code) {
  switch (code) {
    case "VALIDATION_ERROR":
      return 400;
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "METHOD_NOT_ALLOWED":
      return 405;
    case "CONFLICT":
    case "REPLAY_DETECTED":
      return 409;
    case "RATE_LIMITED":
      return 429;
    case "CONFIGURATION_ERROR":
      return 503;
    case "GATEWAY_TIMEOUT":
      return 504;
    case "BUSINESS_ERROR":
      return 400;
    case "INTERNAL_ERROR":
    default:
      return 502;
  }
}
__name(statusForCode, "statusForCode");

// src/auth.js
var SESSION_COOKIE = "__Host-rpa_session";
var CSRF_COOKIE = "__Host-rpa_csrf";
var OAUTH_COOKIE = "__Host-rpa_oauth";
var SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
var OAUTH_TTL_SECONDS = 10 * 60;
var encoder = new TextEncoder();
var UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
var UUID = new RegExp(`^${UUID_SOURCE}$`, "i");
var SESSION_TOKEN = new RegExp(`^(?:${UUID_SOURCE}){2}$`, "i");
function isSessionToken(value) {
  return typeof value === "string" && SESSION_TOKEN.test(value);
}
__name(isSessionToken, "isSessionToken");
function isUuid(value) {
  return typeof value === "string" && UUID.test(value);
}
__name(isUuid, "isUuid");
function readCookies(request) {
  const result = /* @__PURE__ */ new Map();
  const header = request.headers.get("Cookie");
  if (!header) return result;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name) continue;
    if (result.has(name)) result.set(name, null);
    else result.set(name, value);
  }
  return result;
}
__name(readCookies, "readCookies");
function cookieValue(cookies, name) {
  const value = cookies.get(name);
  return typeof value === "string" ? value : null;
}
__name(cookieValue, "cookieValue");
function serializeCookie(name, value, maxAge) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (maxAge !== void 0) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join("; ");
}
__name(serializeCookie, "serializeCookie");
function clearCookie(name) {
  return serializeCookie(name, "", 0);
}
__name(clearCookie, "clearCookie");
function randomBase64Url(byteCount = 32) {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}
__name(randomBase64Url, "randomBase64Url");
async function makeCsrfToken(seed, sessionToken, secret) {
  const key2 = await importHmacKey(secret);
  const message = csrfMessage(seed, sessionToken);
  const signature = await crypto.subtle.sign("HMAC", key2, encoder.encode(message));
  return base64UrlEncode(new Uint8Array(signature));
}
__name(makeCsrfToken, "makeCsrfToken");
async function verifyCsrfToken(token, seed, sessionToken, secret) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  try {
    const signature = base64UrlDecode(token);
    if (signature.byteLength !== 32) return false;
    const key2 = await importHmacKey(secret);
    return await crypto.subtle.verify(
      "HMAC",
      key2,
      signature,
      encoder.encode(csrfMessage(seed, sessionToken))
    );
  } catch {
    return false;
  }
}
__name(verifyCsrfToken, "verifyCsrfToken");
async function signOAuthTransaction(state, secret, now = Date.now()) {
  const encoded = base64UrlEncode(encoder.encode(JSON.stringify({
    state,
    exp: Math.floor(now / 1e3) + OAUTH_TTL_SECONDS
  })));
  const key2 = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key2, encoder.encode(encoded));
  return `${encoded}.${base64UrlEncode(new Uint8Array(signature))}`;
}
__name(signOAuthTransaction, "signOAuthTransaction");
async function verifyOAuthTransaction(value, secret, now = Date.now()) {
  if (typeof value !== "string" || value.length > 2048) return null;
  const separator = value.indexOf(".");
  if (separator <= 0 || separator !== value.lastIndexOf(".")) return null;
  const encoded = value.slice(0, separator);
  let signature;
  let payload;
  try {
    signature = base64UrlDecode(value.slice(separator + 1));
    if (signature.byteLength !== 32) return null;
    const key2 = await importHmacKey(secret);
    const valid = await crypto.subtle.verify("HMAC", key2, signature, encoder.encode(encoded));
    if (!valid) return null;
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(base64UrlDecode(encoded)));
  } catch {
    return null;
  }
  if (!payload || typeof payload.state !== "string" || !/^[A-Za-z0-9._~-]{32,512}$/.test(payload.state) || !Number.isSafeInteger(payload.exp) || payload.exp <= Math.floor(now / 1e3)) return null;
  return payload;
}
__name(verifyOAuthTransaction, "verifyOAuthTransaction");
function equalUtf8ConstantTime(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
__name(equalUtf8ConstantTime, "equalUtf8ConstantTime");
function requireSessionSecret(env) {
  if (typeof env.SESSION_SECRET !== "string" || env.SESSION_SECRET.length < 32) {
    throw new ApiError("CONFIGURATION_ERROR", "Authentication service is not configured.");
  }
  return env.SESSION_SECRET;
}
__name(requireSessionSecret, "requireSessionSecret");
function getSessionToken(cookies) {
  const token = cookieValue(cookies, SESSION_COOKIE);
  return isSessionToken(token) ? token : null;
}
__name(getSessionToken, "getSessionToken");
async function importHmacKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new TypeError("invalid HMAC key configuration");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(importHmacKey, "importHmacKey");
function csrfMessage(seed, sessionToken) {
  return `rpa-money-csrf-v1
${seed}
${sessionToken || "anonymous"}`;
}
__name(csrfMessage, "csrfMessage");
function base64UrlEncode(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function base64UrlDecode(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]*$/.test(value)) {
    throw new TypeError("invalid base64url");
  }
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(base64UrlDecode, "base64UrlDecode");

// src/gas-client.js
var encoder2 = new TextEncoder();
var MAX_ENVELOPE_BYTES = 128 * 1024;
var MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
var DEFAULT_TIMEOUT_MS = 45e3;
var GAS_CODES = /* @__PURE__ */ new Set([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "CONFLICT",
  "RATE_LIMITED",
  "CONFIGURATION_ERROR",
  "REPLAY_DETECTED",
  "INTERNAL_ERROR",
  "BUSINESS_ERROR"
]);
async function callGas(action, params, token, env, options = {}) {
  const requestId = options.requestId || crypto.randomUUID();
  const gasUrl = validateGasUrl(env.GAS_API_URL);
  const secret = requireGasSecret(env.GAS_API_SECRET);
  if (typeof action !== "string" || !action || !isPlainObject(params)) {
    throw new ApiError("VALIDATION_ERROR", "Request parameters are invalid.");
  }
  const payload = JSON.stringify({ action, params, token: token || "" });
  const timestamp = Date.now();
  const nonce = crypto.randomUUID();
  const signingText = [1, requestId, timestamp, nonce, payload].join("\n");
  const signature = await signHex(signingText, secret);
  const envelope = { version: 1, requestId, timestamp, nonce, payload, signature };
  const envelopeText = JSON.stringify(envelope);
  if (encoder2.encode(envelopeText).byteLength > MAX_ENVELOPE_BYTES) {
    throw new ApiError("VALIDATION_ERROR", "Request is too large.");
  }
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ApiError("GATEWAY_TIMEOUT", "The service took too long to respond."));
    }, timeoutMs);
  });
  try {
    const operation = performRequest(fetchImpl, gasUrl, envelopeText, requestId, controller.signal);
    return await Promise.race([operation, timeout]);
  } catch (error2) {
    if (error2 instanceof ApiError) throw error2;
    throw new ApiError("INTERNAL_ERROR", "The service is temporarily unavailable.");
  } finally {
    clearTimeout(timer);
  }
}
__name(callGas, "callGas");
function validateGasUrl(value) {
  if (typeof value !== "string" || value.length > 2048) {
    throw new ApiError("CONFIGURATION_ERROR", "Backend service is not configured.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("CONFIGURATION_ERROR", "Backend service is not configured.");
  }
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || url.port || url.username || url.password || url.search || url.hash || !/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)) {
    throw new ApiError("CONFIGURATION_ERROR", "Backend service is not configured.");
  }
  return url;
}
__name(validateGasUrl, "validateGasUrl");
async function performRequest(fetchImpl, gasUrl, envelopeText, requestId, signal) {
  const initial = await fetchImpl(gasUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json" },
    body: envelopeText,
    redirect: "manual",
    signal
  });
  let finalResponse = initial;
  if (initial.status === 302 || initial.status === 303) {
    const location = initial.headers.get("Location");
    await cancelBody(initial);
    const redirectUrl = validateContentServiceRedirect(location, gasUrl);
    finalResponse = await fetchImpl(redirectUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal
    });
    if (isRedirect(finalResponse.status)) {
      await cancelBody(finalResponse);
      throw new ApiError("INTERNAL_ERROR", "Backend returned an unexpected redirect.");
    }
  } else if (isRedirect(initial.status)) {
    await cancelBody(initial);
    throw new ApiError("INTERNAL_ERROR", "Backend returned an unsupported redirect.");
  }
  if (finalResponse.status < 200 || finalResponse.status >= 300) {
    await cancelBody(finalResponse);
    throw new ApiError("INTERNAL_ERROR", "Backend returned an unsuccessful response.");
  }
  const text = await readTextLimited(finalResponse, MAX_RESPONSE_BYTES);
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid response.");
  }
  if (!isPlainObject(envelope) || envelope.requestId !== requestId || typeof envelope.success !== "boolean") {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid response.");
  }
  if (envelope.success) {
    if (!Object.hasOwn(envelope, "data")) {
      throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid response.");
    }
    return { data: envelope.data, requestId };
  }
  const backendError = envelope.error;
  if (!isPlainObject(backendError) || typeof backendError.code !== "string") {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid response.");
  }
  const code = GAS_CODES.has(backendError.code) ? backendError.code : "BUSINESS_ERROR";
  const message = typeof backendError.message === "string" && backendError.message.trim() ? backendError.message.slice(0, 1e3) : "The request could not be completed.";
  const error2 = new ApiError(code, message);
  if (backendError.noEffect === true) error2.noEffect = true;
  throw error2;
}
__name(performRequest, "performRequest");
function validateContentServiceRedirect(location, gasUrl) {
  if (typeof location !== "string" || location.length > 4096) {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid redirect.");
  }
  let url;
  try {
    url = new URL(location, gasUrl);
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid redirect.");
  }
  if (url.protocol !== "https:" || url.hostname !== "script.googleusercontent.com" || url.port || url.username || url.password || url.hash || url.pathname !== "/macros/echo") {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid redirect.");
  }
  return url;
}
__name(validateContentServiceRedirect, "validateContentServiceRedirect");
async function readTextLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelBody(response);
    throw new ApiError("INTERNAL_ERROR", "Backend response is too large.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError("INTERNAL_ERROR", "Backend response is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Backend returned invalid text.");
  }
}
__name(readTextLimited, "readTextLimited");
async function cancelBody(response) {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
  }
}
__name(cancelBody, "cancelBody");
async function signHex(message, secret) {
  const key2 = await crypto.subtle.importKey(
    "raw",
    encoder2.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key2, encoder2.encode(message)));
  let hex = "";
  for (const byte of signature) hex += byte.toString(16).padStart(2, "0");
  return hex;
}
__name(signHex, "signHex");
function requireGasSecret(value) {
  if (typeof value !== "string" || value.length < 32) {
    throw new ApiError("CONFIGURATION_ERROR", "Backend service is not configured.");
  }
  return value;
}
__name(requireGasSecret, "requireGasSecret");
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
__name(isPlainObject, "isPlainObject");
function isRedirect(status) {
  return status >= 300 && status < 400;
}
__name(isRedirect, "isRedirect");

// src/rate-limit.js
var AUTH_RATE_LIMIT_ROUTES = /* @__PURE__ */ new Set([
  "public",
  "auth.login",
  "auth.register",
  "auth.google",
  "auth.google.callback"
]);
var REQUIRED_ENVIRONMENTS = /* @__PURE__ */ new Set(["staging", "production"]);
var IPV4 = /^(?:0|[1-9][0-9]{0,2})(?:\.(?:0|[1-9][0-9]{0,2})){3}$/;
var IPV4_PARTS = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
var IPV6_CHARS = /^[0-9a-f:.]+$/i;
async function enforceRateLimits(request, env, routeName) {
  const required = REQUIRED_ENVIRONMENTS.has(env?.ENVIRONMENT);
  const apiLimiter = getLimiter(env, "API_RATE_LIMITER", required);
  const authLimiter = getLimiter(env, "AUTH_RATE_LIMITER", required);
  if (!apiLimiter && !authLimiter) return;
  const key2 = `ip:${rateLimitIp(request, required)}`;
  if (apiLimiter) await checkLimiter(apiLimiter, key2);
  if (authLimiter && AUTH_RATE_LIMIT_ROUTES.has(routeName)) {
    await checkLimiter(authLimiter, key2);
  }
}
__name(enforceRateLimits, "enforceRateLimits");
function getLimiter(env, bindingName, required) {
  let binding;
  try {
    binding = env?.[bindingName];
    if (binding === void 0 || binding === null) {
      if (required) throw unavailable();
      return null;
    }
    if (typeof binding.limit !== "function") throw unavailable();
    return binding;
  } catch (error2) {
    if (error2 instanceof ApiError) throw error2;
    throw unavailable();
  }
}
__name(getLimiter, "getLimiter");
async function checkLimiter(binding, key2) {
  let result;
  try {
    result = await binding.limit({ key: key2 });
  } catch {
    throw unavailable();
  }
  if (!result || typeof result.success !== "boolean") throw unavailable();
  if (!result.success) {
    throw new ApiError("RATE_LIMITED", "Qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u. Vui l\xF2ng th\u1EED l\u1EA1i sau.", 429);
  }
}
__name(checkLimiter, "checkLimiter");
function rateLimitIp(request, failClosed) {
  const header = request.headers.get("CF-Connecting-IP");
  if (header === null || header === "") {
    if (!failClosed && isLocalHttpRequest(request)) return "local";
    throw unavailable();
  }
  if (header.length > 64 || header !== header.trim() || /[\s,\u0000-\u001f\u007f]/.test(header)) {
    throw unavailable();
  }
  const ipv4Parts = IPV4_PARTS.exec(header);
  if (ipv4Parts) {
    const octets = ipv4Parts.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) throw unavailable();
    return octets.join(".");
  }
  if (IPV4.test(header)) throw unavailable();
  if (!header.includes(":") || !IPV6_CHARS.test(header)) throw unavailable();
  try {
    const parsed = new URL(`http://[${header}]/`);
    const hostname = parsed.hostname;
    if (!hostname.startsWith("[") || !hostname.endsWith("]")) throw unavailable();
    return hostname.slice(1, -1).toLowerCase();
  } catch (error2) {
    if (error2 instanceof ApiError) throw error2;
    throw unavailable();
  }
}
__name(rateLimitIp, "rateLimitIp");
function isLocalHttpRequest(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}
__name(isLocalHttpRequest, "isLocalHttpRequest");
function unavailable() {
  return new ApiError("INTERNAL_ERROR", "D\u1ECBch v\u1EE5 t\u1EA1m th\u1EDDi kh\xF4ng kh\u1EA3 d\u1EE5ng.", 502);
}
__name(unavailable, "unavailable");

// src/write-queue.js
var LEASE_MS = 5 * 6e4;
var INITIAL_DELAY = 1e4;
var PROCESSING_LEASE = 9e4;
var RETENTION = 7 * 864e5;
var MAX_PENDING = 200;
var MAX_ACTOR_PENDING = 30;
var encoder3 = new TextEncoder();
var UUID2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var ACTIONS = /* @__PURE__ */ new Set(["createNote", "updateNote", "payment", "batchPayment", "deleteNote"]);
var TERMINAL = /* @__PURE__ */ new Set(["confirmed", "failed"]);
var PERMANENT = /* @__PURE__ */ new Set(["VALIDATION_ERROR", "FORBIDDEN", "UNAUTHENTICATED", "CONFLICT", "BUSINESS_ERROR"]);
function error(code, message) {
  return { error: { code, message } };
}
__name(error, "error");
function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + stable(value[k])).join(",") + "}";
  return JSON.stringify(value);
}
__name(stable, "stable");
function bytes64(bytes) {
  return btoa(String.fromCharCode(...bytes));
}
__name(bytes64, "bytes64");
function from64(value) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
__name(from64, "from64");
async function key(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw Error("Queue secret is not configured.");
  return crypto.subtle.importKey("raw", await crypto.subtle.digest("SHA-256", encoder3.encode("rpa-outbox-encryption-v1\n" + secret)), "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(key, "key");
async function queueSessionKey(env, token) {
  const k = await crypto.subtle.importKey("raw", encoder3.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", k, encoder3.encode("rpa-outbox-session-v1\n" + token)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(queueSessionKey, "queueSessionKey");
function queueStub(env) {
  if (!env.WRITE_OUTBOX?.getByName) throw Error("Write queue is unavailable.");
  return env.WRITE_OUTBOX.getByName("ledger:" + env.GAS_API_URL);
}
__name(queueStub, "queueStub");
var OutboxEngine = class {
  static {
    __name(this, "OutboxEngine");
  }
  constructor(storage, env, { now = /* @__PURE__ */ __name(() => Date.now(), "now"), send = callGas } = {}) {
    this.storage = storage;
    this.env = env;
    this.now = now;
    this.send = send;
    this.running = false;
  }
  init() {
    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS leases (session_key TEXT PRIMARY KEY, actor_id TEXT NOT NULL, expires_at INTEGER NOT NULL)`);
    this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS operations (seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT UNIQUE NOT NULL,actor_id TEXT NOT NULL,session_key TEXT NOT NULL,action TEXT NOT NULL,params TEXT NOT NULL,digest TEXT NOT NULL,token TEXT,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,due_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,result TEXT,error TEXT,superseded INTEGER NOT NULL DEFAULT 0,had_uncertain INTEGER NOT NULL DEFAULT 0,retryable INTEGER NOT NULL DEFAULT 1)`);
    this.storage.sql.exec("CREATE INDEX IF NOT EXISTS operations_actor ON operations(actor_id,created_at)");
    this.storage.sql.exec("CREATE INDEX IF NOT EXISTS operations_due ON operations(status,due_at)");
  }
  rows(sql, ...args) {
    return this.storage.sql.exec(sql, ...args).toArray();
  }
  async authorize({ sessionKey, token, user }) {
    if (!/^[a-f0-9]{64}$/.test(sessionKey) || !UUID2.test(user?.id || "") || typeof token !== "string" || await queueSessionKey(this.env, token) !== sessionKey) return error("UNAUTHENTICATED", "Phi\xEAn kh\xF4ng h\u1EE3p l\u1EC7.");
    if (user.active !== true || user.isTemporary || user.assignedTo) {
      this.storage.sql.exec("DELETE FROM leases WHERE session_key=?", sessionKey);
      return error("FORBIDDEN", "T\xE0i kho\u1EA3n ch\u01B0a \u0111\u01B0\u1EE3c k\xEDch ho\u1EA1t.");
    }
    this.storage.sql.exec("INSERT OR REPLACE INTO leases(session_key,actor_id,expires_at) VALUES(?,?,?)", sessionKey, user.id, this.now() + LEASE_MS);
    await this.ensureWakeup();
    return { ok: true };
  }
  revoke({ sessionKey }) {
    this.storage.sql.exec("DELETE FROM leases WHERE session_key=?", sessionKey);
    return { ok: true };
  }
  async schedule(at) {
    const existing = await this.storage.getAlarm();
    if (existing === null || existing > at) await this.storage.setAlarm(at);
  }
  async enqueue({ sessionKey, token, id, action, params }) {
    if (!UUID2.test(id || "") || !ACTIONS.has(action) || !params || typeof params !== "object" || Array.isArray(params) || encoder3.encode(JSON.stringify(params)).length > 64 * 1024) return error("VALIDATION_ERROR", "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7.");
    if (await queueSessionKey(this.env, token) !== sessionKey) return error("UNAUTHENTICATED", "Phi\xEAn kh\xF4ng h\u1EE3p l\u1EC7.");
    const lease = this.rows("SELECT * FROM leases WHERE session_key=?", sessionKey)[0];
    if (!lease || lease.expires_at <= this.now()) return error("LEASE_REQUIRED", "C\u1EA7n x\xE1c th\u1EF1c l\u1EA1i phi\xEAn.");
    const digest = bytes64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder3.encode(stable({ action, params })))));
    let existing = this.rows("SELECT * FROM operations WHERE id=?", id)[0];
    if (existing) {
      if (existing.actor_id !== lease.actor_id || existing.digest !== digest) return error("CONFLICT", "M\xE3 y\xEAu c\u1EA7u \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.");
      if (!(existing.status === "uncertain" && !existing.retryable)) return this.accepted(existing);
    }
    const count = this.rows("SELECT COUNT(*) AS n FROM operations WHERE status NOT IN ('confirmed','failed')")[0].n;
    const actorCount = this.rows("SELECT COUNT(*) AS n FROM operations WHERE actor_id=? AND status NOT IN ('confirmed','failed')", lease.actor_id)[0].n;
    if (count >= MAX_PENDING || actorCount >= MAX_ACTOR_PENDING) return error("RATE_LIMITED", "C\xF3 qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u \u0111ang \u0111\u1ED3ng b\u1ED9. Vui l\xF2ng ch\u1EDD.");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder3.encode(id + "\n" + lease.actor_id) }, await key(this.env.SESSION_SECRET), encoder3.encode(token));
    const tokenBox = JSON.stringify({ iv: bytes64(iv), data: bytes64(new Uint8Array(encrypted)) });
    await this.schedule(this.now() + INITIAL_DELAY);
    const currentLease = this.rows("SELECT * FROM leases WHERE session_key=?", sessionKey)[0];
    if (!currentLease || currentLease.actor_id !== lease.actor_id || currentLease.expires_at <= this.now()) return error("LEASE_REQUIRED", "C\u1EA7n x\xE1c th\u1EF1c l\u1EA1i phi\xEAn.");
    existing = this.rows("SELECT * FROM operations WHERE id=?", id)[0];
    if (existing) {
      if (existing.actor_id !== lease.actor_id || existing.digest !== digest) return error("CONFLICT", "M\xE3 y\xEAu c\u1EA7u \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.");
      if (existing.status === "uncertain" && !existing.retryable) {
        this.storage.sql.exec("UPDATE operations SET status='pending',session_key=?,token=?,retryable=1,due_at=?,updated_at=? WHERE id=?", sessionKey, tokenBox, this.now() + INITIAL_DELAY, this.now(), id);
        return { queued: true, id, status: "pending", action };
      }
      return this.accepted(existing);
    }
    if (this.rows("SELECT COUNT(*) AS n FROM operations WHERE status NOT IN ('confirmed','failed')")[0].n >= MAX_PENDING || this.rows("SELECT COUNT(*) AS n FROM operations WHERE actor_id=? AND status NOT IN ('confirmed','failed')", lease.actor_id)[0].n >= MAX_ACTOR_PENDING) return error("RATE_LIMITED", "C\xF3 qu\xE1 nhi\u1EC1u y\xEAu c\u1EA7u \u0111ang \u0111\u1ED3ng b\u1ED9. Vui l\xF2ng ch\u1EDD.");
    const now = this.now();
    this.storage.sql.exec("INSERT INTO operations(id,actor_id,session_key,action,params,digest,token,status,due_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',?,?,?)", id, lease.actor_id, sessionKey, action, JSON.stringify(params), digest, tokenBox, now + INITIAL_DELAY, now, now);
    return { queued: true, id, status: "pending", action };
  }
  async accepted(row) {
    if (!TERMINAL.has(row.status) && row.retryable) await this.ensureWakeup();
    return { queued: true, id: row.id, status: row.status, action: row.action };
  }
  async ensureWakeup() {
    const next = this.rows("SELECT * FROM operations WHERE status NOT IN ('confirmed','failed') AND retryable=1 ORDER BY seq LIMIT 1")[0];
    if (next) await this.schedule(Math.max(this.now() + 1e3, next.status === "processing" ? next.lease_until : next.due_at));
  }
  publicRow(row) {
    const value = { id: row.id, action: row.action, params: row.params ? JSON.parse(row.params) : void 0, paramsOmitted: !row.params, resultOmitted: !row.result && row.status === "confirmed", status: row.status, needsReview: row.status === "uncertain" && !row.retryable, superseded: !!row.superseded, createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
    if (row.result) value.result = JSON.parse(row.result);
    if (row.error) value.error = JSON.parse(row.error);
    return value;
  }
  list({ actorId }) {
    if (!UUID2.test(actorId || "")) return error("UNAUTHENTICATED", "Phi\xEAn kh\xF4ng h\u1EE3p l\u1EC7.");
    const fields = "id,action,status,created_at,updated_at,error,superseded,retryable,CASE WHEN length(result)<=16384 THEN result ELSE NULL END AS result";
    const pending = this.rows("SELECT " + fields + ",params FROM operations WHERE actor_id=? AND status NOT IN ('confirmed','failed') ORDER BY seq", actorId);
    const terminal = this.rows("SELECT " + fields + ",CASE WHEN length(params)<=16384 THEN params ELSE NULL END AS params FROM operations WHERE actor_id=? AND status IN ('confirmed','failed') ORDER BY updated_at DESC LIMIT 100", actorId);
    let budget = 2 * 1024 * 1024;
    const operations = [...pending, ...terminal].map((row) => {
      const value = this.publicRow(row);
      if (encoder3.encode(JSON.stringify(value)).length > budget) {
        delete value.result;
        value.resultOmitted = value.status === "confirmed";
        if (TERMINAL.has(value.status)) {
          delete value.params;
          value.paramsOmitted = true;
        }
      }
      budget -= encoder3.encode(JSON.stringify(value)).length;
      return value;
    });
    return { operations };
  }
  get({ actorId, id }) {
    const row = this.rows("SELECT * FROM operations WHERE id=? AND actor_id=?", id, actorId)[0];
    return row ? this.publicRow(row) : error("NOT_FOUND", "Kh\xF4ng t\xECm th\u1EA5y y\xEAu c\u1EA7u.");
  }
  log(row, status, startedAt) {
    try {
      console.log(JSON.stringify({ event: "write_queue", operationId: row.id, action: row.action, status, attempt: row.attempts + 1, durationMs: Math.max(0, this.now() - startedAt) }));
    } catch {
    }
  }
  async alarm() {
    if (this.running) {
      await this.schedule(this.now() + PROCESSING_LEASE);
      return;
    }
    this.running = true;
    try {
      this.storage.sql.exec("DELETE FROM operations WHERE status IN ('confirmed','failed') AND updated_at<?", this.now() - RETENTION);
      this.storage.sql.exec("DELETE FROM leases WHERE expires_at<?", this.now());
      this.storage.sql.exec("UPDATE operations SET status='uncertain',had_uncertain=1,due_at=?,lease_until=0 WHERE status='processing' AND lease_until<=?", this.now(), this.now());
      for (let i = 0; i < 5; i++) {
        const row = this.rows("SELECT * FROM operations WHERE status NOT IN ('confirmed','failed') AND retryable=1 ORDER BY seq LIMIT 1")[0];
        if (!row || row.status === "processing" || row.due_at > this.now()) break;
        await this.schedule(this.now() + PROCESSING_LEASE + 1e3);
        const startedAt = this.now();
        this.storage.sql.exec("UPDATE operations SET status='processing',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=?", this.now() + PROCESSING_LEASE, this.now(), row.id);
        try {
          const box = JSON.parse(row.token);
          const token = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: from64(box.iv), additionalData: encoder3.encode(row.id + "\n" + row.actor_id) }, await key(this.env.SESSION_SECRET), from64(box.data)));
          const reply = await this.send("applyQueuedMutation", { id: row.id, action: row.action, params: JSON.parse(row.params) }, token, this.env);
          if (reply?.data?.id !== row.id || reply.data?.status !== "completed" || !Object.hasOwn(reply.data, "result")) throw Error("Invalid queue backend acknowledgement.");
          this.storage.sql.exec("UPDATE operations SET status='confirmed',result=?,superseded=?,error=NULL,token=NULL,lease_until=0,updated_at=? WHERE id=?", JSON.stringify(reply.data.result), reply.data.superseded ? 1 : 0, this.now(), row.id);
          this.log(row, "confirmed", startedAt);
        } catch (cause) {
          const code = PERMANENT.has(cause?.code) ? cause.code : "INTERNAL_ERROR";
          const permanent = PERMANENT.has(code);
          const needsReview = permanent && !!row.had_uncertain && cause?.noEffect !== true;
          const message = needsReview ? "Kh\xF4ng th\u1EC3 x\xE1c nh\u1EADn l\u1EA7n ghi tr\u01B0\u1EDBc. H\xE3y \u0111\u0103ng nh\u1EADp v\xE0 ch\u1ECDn \u0110\u1ED1i so\xE1t l\u1EA1i; kh\xF4ng t\u1EA1o y\xEAu c\u1EA7u thay th\u1EBF." : permanent && typeof cause.message === "string" ? cause.message.slice(0, 500) : "Ch\u01B0a x\xE1c nh\u1EADn \u0111\u01B0\u1EE3c k\u1EBFt qu\u1EA3; h\u1EC7 th\u1ED1ng s\u1EBD \u0111\u1ED1i so\xE1t b\u1EB1ng c\xF9ng m\xE3 y\xEAu c\u1EA7u.";
          const delay = Math.min(36e5, 3e4 * 2 ** Math.min(row.attempts, 7));
          this.storage.sql.exec("UPDATE operations SET status=?,error=?,token=CASE WHEN ? THEN NULL ELSE token END,lease_until=0,due_at=?,updated_at=?,retryable=?,had_uncertain=? WHERE id=?", permanent && !needsReview ? "failed" : "uncertain", JSON.stringify({ code: needsReview ? "RECONCILIATION_REQUIRED" : code, message }), permanent ? 1 : 0, this.now() + delay, this.now(), needsReview ? 0 : 1, needsReview || !permanent ? 1 : 0, row.id);
          this.log(row, needsReview ? "needsReview" : permanent ? "failed" : "uncertain", startedAt);
          if (!permanent) break;
        }
      }
    } finally {
      this.running = false;
      const next = this.rows("SELECT * FROM operations WHERE status NOT IN ('confirmed','failed') AND retryable=1 ORDER BY seq LIMIT 1")[0];
      if (next) await this.schedule(Math.max(this.now() + 1e3, next.status === "processing" ? next.lease_until : next.due_at));
      else await this.schedule(this.now() + RETENTION);
    }
  }
};

// src/read-cache.js
var BOOTSTRAP_CACHE_TTL_MS = 15e3;
var BOOTSTRAP_CACHE_MAX_BYTES = 2 * 1024 * 1024;
var CACHE_ENTRY_SCHEMA = 1;
var VERSION = /^(?:initial|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
var encoder4 = new TextEncoder();
async function bootstrapCacheRequest({ secret, origin, gasApiUrl, token }) {
  if (typeof secret !== "string" || secret.length < 32 || typeof origin !== "string" || typeof gasApiUrl !== "string" || typeof token !== "string" || !token) {
    throw new TypeError("Invalid private bootstrap cache key input.");
  }
  const key2 = await crypto.subtle.importKey(
    "raw",
    encoder4.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const message = ["rpa-money-bootstrap-cache-v1", origin, gasApiUrl, token].join("\n");
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key2, encoder4.encode(message)));
  const digest = base64UrlEncode2(signature);
  return new Request(`${origin}/api/__private-bootstrap-cache__/${digest}`, { method: "GET" });
}
__name(bootstrapCacheRequest, "bootstrapCacheRequest");
async function readBootstrapCache(cache, request, now = Date.now()) {
  const response = await cache.match(request);
  if (!response) return null;
  try {
    const text = await readTextLimited2(response, BOOTSTRAP_CACHE_MAX_BYTES);
    const entry = JSON.parse(text);
    if (!validBootstrapCacheEntry(entry, now)) {
      await deleteQuietly(cache, request);
      return null;
    }
    return entry;
  } catch {
    await deleteQuietly(cache, request);
    return null;
  }
}
__name(readBootstrapCache, "readBootstrapCache");
async function writeBootstrapCache(cache, request, entry) {
  const value = {
    schema: CACHE_ENTRY_SCHEMA,
    savedAt: entry.savedAt,
    version: entry.version,
    user: entry.user,
    snapshot: entry.snapshot
  };
  const text = JSON.stringify(value);
  if (encoder4.encode(text).byteLength > BOOTSTRAP_CACHE_MAX_BYTES) return false;
  const response = new Response(text, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${BOOTSTRAP_CACHE_TTL_MS / 1e3}`
    }
  });
  await cache.put(request, response);
  return true;
}
__name(writeBootstrapCache, "writeBootstrapCache");
function validBootstrapCacheEntry(entry, now = Date.now()) {
  if (!isPlainObject2(entry) || entry.schema !== CACHE_ENTRY_SCHEMA || !Number.isSafeInteger(entry.savedAt) || entry.savedAt > now || now - entry.savedAt >= BOOTSTRAP_CACHE_TTL_MS || typeof entry.version !== "string" || !VERSION.test(entry.version) || !isPublicUser(entry.user) || !isPlainObject2(entry.snapshot) || !isPublicUser(entry.snapshot.user) || publicUserFingerprint(entry.user) !== publicUserFingerprint(entry.snapshot.user)) return false;
  return true;
}
__name(validBootstrapCacheEntry, "validBootstrapCacheEntry");
function isBootstrapVersion(value) {
  return typeof value === "string" && VERSION.test(value);
}
__name(isBootstrapVersion, "isBootstrapVersion");
function isPublicUser(value) {
  if (!isPlainObject2(value)) return false;
  if (!isUuid(value.id) || typeof value.name !== "string" || value.name.length > 2048 || typeof value.active !== "boolean" || !["admin", "member"].includes(value.role)) return false;
  if (Object.hasOwn(value, "username") && (typeof value.username !== "string" || value.username.length > 2048)) return false;
  if (Object.hasOwn(value, "email") && (typeof value.email !== "string" || value.email.length > 2048)) return false;
  if (Object.hasOwn(value, "isTemporary") && value.isTemporary !== true) return false;
  if (Object.hasOwn(value, "assignedTo") && !isUuid(value.assignedTo)) return false;
  return true;
}
__name(isPublicUser, "isPublicUser");
function publicUserFingerprint(value) {
  if (!isPublicUser(value)) return null;
  return stableJson(value);
}
__name(publicUserFingerprint, "publicUserFingerprint");
async function readTextLimited2(response, maxBytes) {
  const declaredLength = Number(response.headers?.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RangeError("Cached bootstrap entry is too large.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          void reader.cancel().catch(() => {
          });
        } catch {
        }
        throw new RangeError("Cached bootstrap entry is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
__name(readTextLimited2, "readTextLimited");
async function deleteQuietly(cache, request) {
  try {
    if (typeof cache.delete === "function") await cache.delete(request);
  } catch {
  }
}
__name(deleteQuietly, "deleteQuietly");
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  const fields = Object.keys(value).sort().map((key2) => `${JSON.stringify(key2)}:${stableJson(value[key2])}`);
  return `{${fields.join(",")}}`;
}
__name(stableJson, "stableJson");
function isPlainObject2(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
__name(isPlainObject2, "isPlainObject");
function base64UrlEncode2(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64UrlEncode2, "base64UrlEncode");

// src/router.js
var MAX_BROWSER_BODY_BYTES = 64 * 1024;
var UUID3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var NOTE_FIELDS = [
  "id",
  "title",
  "date",
  "total",
  "category",
  "payerId",
  "detail",
  "userIds",
  "mode",
  "unit",
  "pinnedAmounts",
  "fixed",
  "amounts"
];
var NOTE_OPTIONAL_FIELDS = ["unit", "pinnedAmounts", "fixed", "amounts"];
var USER_CATEGORIES = /* @__PURE__ */ new Set(["\u0102n u\u1ED1ng", "C\xE0 ph\xEA", "Kh\xE1c"]);
var ID_MAP_LIMIT = 200;
var WRITE_QUEUE_LEASE_TTL_MS = 5 * 60 * 1e3;
function isApiPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}
__name(isApiPath, "isApiPath");
async function handleApiRequest(request, env) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let routeName = "unmatched";
  let response;
  const metrics = { cacheState: "NONE", upstreamMs: 0 };
  try {
    const url = new URL(request.url);
    const route = resolveRoute(url.pathname);
    if (!route) throw new ApiError("NOT_FOUND", "Route not found.");
    routeName = route.name;
    if (!route.methods.includes(request.method)) {
      throw new ApiError("METHOD_NOT_ALLOWED", "Method not allowed.", 405);
    }
    await enforceRateLimits(request, env, routeName);
    response = await route.handle({ request, url, env, requestId, metrics });
  } catch (error2) {
    const safeError = error2 instanceof ApiError ? error2 : new ApiError("INTERNAL_ERROR", "The request could not be completed.");
    response = jsonResponse({
      success: false,
      error: { code: safeError.code, message: safeError.message },
      requestId
    }, safeError.status, { allow: safeError.code === "METHOD_NOT_ALLOWED" ? routeMethods(request) : null });
  } finally {
    const durationMs = Math.max(0, Date.now() - startedAt);
    if (response) response.headers.set("X-RPA-Write-Queue", writeQueueCapability(env));
    if (routeName === "bootstrap" && response) {
      const cacheState = safeCacheState(metrics.cacheState);
      response.headers.set("X-RPA-Cache", cacheState);
      const timing = [];
      if (isSafeMilliseconds(metrics.upstreamMs)) timing.push(`upstream;dur=${metrics.upstreamMs}`);
      timing.push(`total;dur=${durationMs}`, `cache;desc=${cacheState}`);
      response.headers.set("Server-Timing", timing.join(", "));
    }
    const status = response?.status || 500;
    const logEvent = {
      event: "api_request",
      route: routeName,
      status,
      requestId,
      durationMs
    };
    if (routeName === "bootstrap") {
      logEvent.cacheState = safeCacheState(metrics.cacheState);
      if (isSafeMilliseconds(metrics.upstreamMs)) logEvent.upstreamMs = metrics.upstreamMs;
    }
    console.log(JSON.stringify(logEvent));
  }
  return response;
}
__name(handleApiRequest, "handleApiRequest");
const bankProfileHandlers=createBankProfileHandlers({requireSession,requireMutation,readJsonObject,freshQueueActor,callGas});
function resolveRoute(pathname) {
  if(pathname==='/api/bank-profile')return {name:'bank-profile.own',methods:['GET','PUT'],handle:bankProfileHandlers.own};
  const bankMatch=/^\/api\/users\/([^/]+)\/bank-profile$/.exec(pathname);
  if(bankMatch)return {name:'bank-profile.creditor',methods:['GET'],handle:context=>bankProfileHandlers.creditor(context,bankMatch[1])};
  const fixed = {
    "/api/csrf": { name: "csrf", methods: ["GET"], handle: csrfRoute },
    "/api/public": { name: "public", methods: ["GET"], handle: publicRoute },
    "/api/auth/login": { name: "auth.login", methods: ["POST"], handle: loginRoute },
    "/api/auth/register": { name: "auth.register", methods: ["POST"], handle: registerRoute },
    "/api/me": { name: "me", methods: ["GET"], handle: meRoute },
    "/api/data": { name: "data", methods: ["GET"], handle: dataRoute },
    "/api/bootstrap": { name: "bootstrap", methods: ["GET"], handle: bootstrapRoute },
    "/api/operations": { name: "operations", methods: ["GET"], handle: operationsRoute },
    "/api/auth/google": { name: "auth.google", methods: ["GET"], handle: googleStartRoute },
    "/api/auth/google/callback": { name: "auth.google.callback", methods: ["GET"], handle: googleCallbackRoute },
    "/api/auth/logout": { name: "auth.logout", methods: ["POST"], handle: logoutRoute },
    "/api/admin/google-oauth": { name: "admin.google_oauth", methods: ["PUT"], handle: settingsRoute },
    "/api/admin/users/temp": { name: "admin.users.temp.create", methods: ["POST"], handle: createTempUserRoute },
    "/api/auth/password": { name: "auth.password", methods: ["PUT"], handle: passwordRoute },
    "/api/notes": { name: "notes.create", methods: ["POST"], handle: createNoteRoute },
    "/api/payments/batches": { name: "payments.batches.create", methods: ["POST"], handle: batchPaymentRoute }
  };
  if (fixed[pathname]) return fixed[pathname];
  let match = /^\/api\/admin\/users\/([^/]+)\/assignment-preview$/.exec(pathname);
  if (match) return routeWithId("admin.users.assignment_preview", ["POST"], previewTempUserAssignmentRoute, match[1]);
  match = /^\/api\/admin\/users\/([^/]+)\/assignment$/.exec(pathname);
  if (match) return routeWithId("admin.users.assignment", ["POST"], assignTempUserRoute, match[1]);
  match = /^\/api\/admin\/users\/([^/]+)$/.exec(pathname);
  if (match) return routeWithId("admin.user", ["PATCH"], activateRoute, match[1]);
  match = /^\/api\/notes\/([^/]+)\/payments\/([^/]+)$/.exec(pathname);
  if (match) return routeWithIds("notes.payment", ["PATCH"], paymentRoute, match[1], match[2]);
  match = /^\/api\/operations\/([^/]+)$/.exec(pathname);
  if (match) return routeWithId("operations.item", ["GET"], operationRoute, match[1]);
  match = /^\/api\/notes\/([^/]+)$/.exec(pathname);
  if (match) {
    return match[1] === "" ? null : routeWithId("notes.item", ["PUT", "DELETE"], noteItemRoute, match[1]);
  }
  return null;
}
__name(resolveRoute, "resolveRoute");
function routeWithId(name, methods, handler, rawId) {
  return {
    name,
    methods,
    handle: /* @__PURE__ */ __name((context) => handler({ ...context, id: decodeRouteId(rawId) }), "handle")
  };
}
__name(routeWithId, "routeWithId");
function routeWithIds(name, methods, handler, rawId, rawOtherId) {
  return {
    name,
    methods,
    handle: /* @__PURE__ */ __name((context) => handler({
      ...context,
      id: decodeRouteId(rawId),
      userId: decodeRouteId(rawOtherId)
    }), "handle")
  };
}
__name(routeWithIds, "routeWithIds");
async function csrfRoute({ request, url, env, requestId }) {
  rejectQuery(url);
  const secret = requireSessionSecret(env);
  const cookies = readCookies(request);
  const token = getSessionToken(cookies);
  let seed = cookieValue(cookies, CSRF_COOKIE);
  let setSeed = false;
  if (!seed || !/^[A-Za-z0-9_-]{43}$/.test(seed)) {
    seed = randomBase64Url(32);
    setSeed = true;
  }
  const csrfToken = await makeCsrfToken(seed, token, secret);
  const headers = setSeed ? [{ name: CSRF_COOKIE, value: serializeCookie(CSRF_COOKIE, seed, SESSION_TTL_SECONDS) }] : [];
  return jsonResponse({ success: true, data: { csrfToken }, requestId }, 200, { cookies: headers });
}
__name(csrfRoute, "csrfRoute");
async function publicRoute({ request, url, env, requestId }) {
  rejectQuery(url);
  const result = await callGas("public", {}, "", env, { requestId });
  return success(result, 200);
}
__name(publicRoute, "publicRoute");
async function loginRoute(context) {
  await requireMutation(context);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["username", "password"], ["username", "password"]);
  const username = requireString(body.username, "username", 40);
  const password = requireString(body.password, "password", 72);
  if (!/^[a-z0-9_.-]{3,40}$/i.test(username) || password.length === 0) {
    throw validationError();
  }
  const result = await callGas("login", { username, password }, "", context.env, { requestId: context.requestId });
  return sessionResult(result, context.requestId, context.env);
}
__name(loginRoute, "loginRoute");
async function registerRoute(context) {
  await requireMutation(context);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["username", "name", "password"], ["username", "name", "password"]);
  const username = requireString(body.username, "username", 40);
  const name = requireString(body.name, "name", 80);
  const password = requireString(body.password, "password", 72);
  if (!/^[a-z0-9_.-]{3,40}$/i.test(username) || !name.trim() || password.length < 10) {
    throw validationError();
  }
  const result = await callGas("register", { username, name, password }, "", context.env, { requestId: context.requestId });
  return sessionResult(result, context.requestId, context.env);
}
__name(registerRoute, "registerRoute");
async function meRoute({ request, url, env, requestId }) {
  rejectQuery(url);
  const token = requireSession(request);
  const result = await callGas("me", {}, token, env, { requestId });
  return success(result, 200);
}
__name(meRoute, "meRoute");
async function dataRoute({ request, url, env, requestId }) {
  rejectQuery(url);
  const token = requireSession(request);
  const redirectUri = callbackUri(request, env);
  const result = await callGas("data", { redirectUri }, token, env, { requestId });
  const data = result.data;
  if (data && typeof data === "object" && data.settings && typeof data.settings === "object") {
    data.settings.redirectUri = redirectUri;
  }
  return success({ ...result, data }, 200);
}
__name(dataRoute, "dataRoute");
async function operationsRoute({ request, url, env, requestId }) {
  rejectQuery(url);
  const token = requireSession(request);
  const actor = await freshQueueActor(token, env, requestId);
  const sessionKey = await queueSessionKey(env, token);
  const outbox = queueStub(env);
  const result = await invokeWriteQueue(outbox, "list", { sessionKey, actorId: actor.id });
  const errorCode = queueResultErrorCode(result);
  if (errorCode) throw writeQueueError(errorCode);
  if (!isPlainObject3(result) || !Array.isArray(result.operations) || result.operations.length > 130) {
    throw new ApiError("INTERNAL_ERROR", "The write queue returned an invalid response.");
  }
  return jsonResponse({ success: true, data: { operations: result.operations }, requestId }, 200);
}
__name(operationsRoute, "operationsRoute");
async function operationRoute({ request, url, env, requestId, id }) {
  rejectQuery(url);
  if (!isUuid(id)) throw validationError("Invalid operation id.");
  const token = requireSession(request);
  const actor = await freshQueueActor(token, env, requestId);
  const sessionKey = await queueSessionKey(env, token);
  const outbox = queueStub(env);
  const operation = await invokeWriteQueue(outbox, "get", {
    sessionKey,
    actorId: actor.id,
    id: id.toLowerCase()
  });
  const isOperation = isPlainObject3(operation) && operation.id === id.toLowerCase() && ["pending", "processing", "uncertain", "confirmed", "failed"].includes(operation.status);
  const errorCode = isOperation ? null : queueResultErrorCode(operation);
  if (errorCode) throw writeQueueError(errorCode);
  if (operation === null) throw new ApiError("NOT_FOUND", "Operation not found.");
  if (!isPlainObject3(operation) || operation.id !== id.toLowerCase()) {
    throw new ApiError("INTERNAL_ERROR", "The write queue returned an invalid response.");
  }
  return jsonResponse({ success: true, data: operation, requestId }, 200);
}
__name(operationRoute, "operationRoute");
async function freshQueueActor(token, env, requestId) {
  const result = await callGas("me", {}, token, env, { requestId });
  if (!isPublicUser(result.data)) {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid user.");
  }
  if (!result.data.active) throw new ApiError("FORBIDDEN", "This account is not active.");
  return result.data;
}
__name(freshQueueActor, "freshQueueActor");
async function enqueueQueueMutation(context, token, action, params) {
  const id = operationIdHeader(context.request);
  if (id === null) return null;
  const sessionKey = await queueSessionKey(context.env, token);
  const outbox = queueStub(context.env);
  let result;
  let errorCode;
  try {
    result = await invokeWriteQueue(outbox, "enqueue", {
      sessionKey,
      token,
      id,
      action,
      params
    });
    errorCode = queueResultErrorCode(result);
  } catch (error2) {
    if (error2.queueCode !== "LEASE_REQUIRED") throw error2;
    errorCode = "LEASE_REQUIRED";
  }
  if (errorCode === "LEASE_REQUIRED") {
    const actor = await freshQueueActor(token, context.env, context.requestId);
    await authorizeQueueStrict(outbox, sessionKey, token, actor);
    result = await invokeWriteQueue(outbox, "enqueue", {
      sessionKey,
      token,
      id,
      action,
      params
    });
    errorCode = queueResultErrorCode(result);
  }
  if (errorCode) throw writeQueueError(errorCode);
  if (!isPlainObject3(result) || result.queued !== true || result.id !== id) {
    throw new ApiError("INTERNAL_ERROR", "The write queue returned an invalid response.");
  }
  return jsonResponse({ success: true, data: result, requestId: context.requestId }, 202);
}
__name(enqueueQueueMutation, "enqueueQueueMutation");
function operationIdHeader(request) {
  const value = request.headers.get("X-RPA-Operation-Id");
  if (value === null) return null;
  if (!isUuid(value)) throw validationError("Invalid operation id.");
  return value.toLowerCase();
}
__name(operationIdHeader, "operationIdHeader");
async function syncQueueAuthorizationBestEffort(env, token, user) {
  try {
    const sessionKey = await queueSessionKey(env, token);
    const outbox = queueStub(env);
    if (user.active) await authorizeQueueStrict(outbox, sessionKey, token, user);
    else await invokeQueueAndCheck(outbox, "revoke", { sessionKey });
  } catch {
  }
}
__name(syncQueueAuthorizationBestEffort, "syncQueueAuthorizationBestEffort");
async function revokeQueueLeaseBestEffort(env, token) {
  try {
    const sessionKey = await queueSessionKey(env, token);
    const outbox = queueStub(env);
    await invokeQueueAndCheck(outbox, "revoke", { sessionKey });
  } catch {
  }
}
__name(revokeQueueLeaseBestEffort, "revokeQueueLeaseBestEffort");
async function authorizeQueueStrict(outbox, sessionKey, token, user) {
  const result = await invokeWriteQueue(outbox, "authorize", {
    sessionKey,
    token,
    user,
    expiresAt: Date.now() + WRITE_QUEUE_LEASE_TTL_MS
  });
  const errorCode = queueResultErrorCode(result);
  if (errorCode) throw writeQueueError(errorCode);
  if (!isPlainObject3(result) || result.ok !== true) {
    throw new ApiError("INTERNAL_ERROR", "The write queue could not authorize this session.");
  }
}
__name(authorizeQueueStrict, "authorizeQueueStrict");
async function invokeQueueAndCheck(outbox, method, params) {
  const result = await invokeWriteQueue(outbox, method, params);
  const errorCode = queueResultErrorCode(result);
  if (errorCode) throw writeQueueError(errorCode);
  if (!isPlainObject3(result) || result.ok !== true) {
    throw new ApiError("INTERNAL_ERROR", "The write queue returned an invalid response.");
  }
  return result;
}
__name(invokeQueueAndCheck, "invokeQueueAndCheck");
async function invokeWriteQueue(outbox, method, params) {
  if (!outbox || typeof outbox[method] !== "function") {
    throw new ApiError("INTERNAL_ERROR", "The write queue is unavailable.");
  }
  try {
    return await outbox[method](params);
  } catch (error2) {
    if (error2 instanceof ApiError) throw error2;
    if (error2?.code === "LEASE_REQUIRED") {
      const leaseError = new ApiError("LEASE_REQUIRED", "A fresh session check is required before queuing this write.", 401);
      leaseError.queueCode = "LEASE_REQUIRED";
      throw leaseError;
    }
    if (typeof error2?.code === "string") throw writeQueueError(error2.code);
    throw new ApiError("INTERNAL_ERROR", "The write queue is temporarily unavailable.");
  }
}
__name(invokeWriteQueue, "invokeWriteQueue");
function queueResultErrorCode(result) {
  if (!isPlainObject3(result) || !Object.hasOwn(result, "error")) return null;
  if (!isPlainObject3(result.error) || typeof result.error.code !== "string") {
    throw new ApiError("INTERNAL_ERROR", "The write queue returned an invalid error.");
  }
  return result.error.code;
}
__name(queueResultErrorCode, "queueResultErrorCode");
function writeQueueError(code) {
  switch (code) {
    case "LEASE_REQUIRED":
      return new ApiError("UNAUTHENTICATED", "A fresh session check is required before queuing this write.");
    case "UNAUTHENTICATED":
      return new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
    case "FORBIDDEN":
      return new ApiError("FORBIDDEN", "This account is not allowed to perform this operation.");
    case "CONFLICT":
      return new ApiError("CONFLICT", "The operation ID conflicts with a different queued write.");
    case "RATE_LIMITED":
      return new ApiError("RATE_LIMITED", "The write queue is full. Try again shortly.");
    case "NOT_FOUND":
      return new ApiError("NOT_FOUND", "Operation not found.");
    case "VALIDATION_ERROR":
      return new ApiError("VALIDATION_ERROR", "The queued operation is invalid.");
    default:
      return new ApiError("INTERNAL_ERROR", "The write queue is temporarily unavailable.");
  }
}
__name(writeQueueError, "writeQueueError");
async function bootstrapRoute({ request, url, env, requestId, metrics }) {
  rejectQuery(url);
  const token = requireSession(request);
  const origin = appOrigin(request, env);
  const redirectUri = `${origin}/api/auth/google/callback`;
  const bypassCache = requestHasNoCache(request);
  const cache = defaultReadCache();
  let cacheRequest = null;
  let cached = null;
  let cacheReady = false;
  metrics.cacheState = bypassCache ? "BYPASS" : "NONE";
  if (cache) {
    try {
      cacheRequest = await bootstrapCacheRequest({
        secret: env.SESSION_SECRET,
        origin,
        gasApiUrl: env.GAS_API_URL,
        token
      });
      cacheReady = true;
      if (!bypassCache) {
        cached = await readBootstrapCache(cache, cacheRequest);
        metrics.cacheState = "MISS";
      }
    } catch {
      cacheRequest = null;
      cached = null;
      cacheReady = false;
      metrics.cacheState = bypassCache ? "BYPASS" : "NONE";
    }
  }
  const callBootstrap = /* @__PURE__ */ __name(async (knownVersion, correlatedRequest = true) => {
    const params = { redirectUri };
    if (knownVersion !== void 0) params.knownVersion = knownVersion;
    const startedAt = Date.now();
    try {
      return await callGas(
        "bootstrap",
        params,
        token,
        env,
        correlatedRequest ? { requestId } : {}
      );
    } finally {
      const upstreamMs = Math.max(0, Date.now() - startedAt);
      metrics.upstreamMs = Math.min(Number.MAX_SAFE_INTEGER, metrics.upstreamMs + upstreamMs);
    }
  }, "callBootstrap");
  try {
    let backend = await callBootstrap(bypassCache ? void 0 : cached?.version);
    let reply = validateBootstrapReply(backend.data);
    if (reply.unchanged) {
      const userMatchesCache = cached && cached.version === reply.version && cached.user.id === reply.user.id && cached.user.role === reply.user.role && cached.user.active === reply.user.active && publicUserFingerprint(reply.user) === publicUserFingerprint(cached.user);
      if (userMatchesCache && reply.user.active) {
        metrics.cacheState = "REVALIDATED";
        const snapshot2 = responseSnapshot(cached.snapshot, reply.user);
        await syncQueueAuthorizationBestEffort(env, token, reply.user);
        return success({ data: snapshot2, requestId }, 200);
      }
      backend = await callBootstrap(void 0, false);
      reply = validateBootstrapReply(backend.data);
      if (reply.unchanged) throw invalidBootstrapResponse();
    }
    if (!reply.snapshot || !reply.user.active) {
      metrics.cacheState = cacheResultState(bypassCache, cacheReady);
      if (!reply.user.active) await syncQueueAuthorizationBestEffort(env, token, reply.user);
      return success({ data: { user: reply.user }, requestId }, 200);
    }
    const snapshot = responseSnapshot(reply.snapshot, reply.user);
    if (cache && cacheRequest) {
      try {
        await writeBootstrapCache(cache, cacheRequest, {
          savedAt: Date.now(),
          version: reply.version,
          user: reply.user,
          snapshot
        });
      } catch {
        cacheReady = false;
        metrics.cacheState = "NONE";
      }
    }
    if (!bypassCache && !cacheReady) metrics.cacheState = "NONE";
    await syncQueueAuthorizationBestEffort(env, token, reply.user);
    return success({ data: snapshot, requestId }, 200);
  } catch (error2) {
    metrics.cacheState = "NONE";
    throw error2;
  }
}
__name(bootstrapRoute, "bootstrapRoute");
function validateBootstrapReply(value) {
  if (!isPlainObject3(value) || !isPublicUser(value.user) || !isBootstrapVersion(value.version) || typeof value.unchanged !== "boolean") throw invalidBootstrapResponse();
  if (value.unchanged) return { user: value.user, version: value.version, unchanged: true };
  if (!Object.hasOwn(value, "snapshot")) {
    if (value.user.active) throw invalidBootstrapResponse();
    return { user: value.user, version: value.version, unchanged: false, snapshot: null };
  }
  if (!isPlainObject3(value.snapshot) || !isPublicUser(value.snapshot.user) || publicUserFingerprint(value.user) !== publicUserFingerprint(value.snapshot.user)) throw invalidBootstrapResponse();
  return { user: value.user, version: value.version, unchanged: false, snapshot: value.snapshot };
}
__name(validateBootstrapReply, "validateBootstrapReply");
function responseSnapshot(snapshot, user) {
  const data = { ...snapshot, user };
  if (user.role !== "admin") data.settings = null;
  return data;
}
__name(responseSnapshot, "responseSnapshot");
function invalidBootstrapResponse() {
  return new ApiError("INTERNAL_ERROR", "Backend returned an invalid bootstrap response.");
}
__name(invalidBootstrapResponse, "invalidBootstrapResponse");
function defaultReadCache() {
  try {
    const cache = globalThis.caches?.default;
    if (cache && typeof cache.match === "function" && typeof cache.put === "function") return cache;
  } catch {
  }
  return null;
}
__name(defaultReadCache, "defaultReadCache");
function requestHasNoCache(request) {
  const cacheControl = request.headers.get("Cache-Control") || "";
  const pragma = request.headers.get("Pragma") || "";
  const directives = `${cacheControl},${pragma}`.split(",").map((value) => value.trim().toLowerCase());
  return directives.some((directive) => directive === "no-cache" || directive.startsWith("no-cache="));
}
__name(requestHasNoCache, "requestHasNoCache");
function cacheResultState(bypassCache, cacheReady) {
  if (bypassCache) return "BYPASS";
  return cacheReady ? "MISS" : "NONE";
}
__name(cacheResultState, "cacheResultState");
async function googleStartRoute({ request, url, env, requestId }) {
  rejectQuery(url);
  const secret = requireSessionSecret(env);
  const redirectUri = callbackUri(request, env);
  const result = await callGas("googleStart", { redirectUri }, "", env, { requestId });
  const authorizationUrl = validateGoogleAuthorizationUrl(result.data?.url, redirectUri);
  const state = authorizationUrl.searchParams.get("state");
  const oauthCookie = await signOAuthTransaction(state, secret);
  return jsonResponse({ success: true, data: { url: authorizationUrl.toString() }, requestId }, 200, {
    cookies: [{ name: OAUTH_COOKIE, value: serializeCookie(OAUTH_COOKIE, oauthCookie, OAUTH_TTL_SECONDS) }]
  });
}
__name(googleStartRoute, "googleStartRoute");
async function googleCallbackRoute({ request, url, env, requestId }) {
  const headers = baseHeaders();
  const secret = requireSessionSecret(env);
  const redirectUri = callbackUri(request, env);
  let finalLocation = "/?authError=google_failed";
  let session = null;
  try {
    validateCallbackQuery(url);
    const state = url.searchParams.get("state");
    const transaction = await verifyOAuthTransaction(cookieValue(readCookies(request), OAUTH_COOKIE), secret);
    if (!transaction || !equalUtf8ConstantTime(transaction.state, state)) {
      throw new ApiError("UNAUTHENTICATED", "Google sign-in could not be verified.");
    }
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      finalLocation = oauthError === "access_denied" ? "/?authError=google_cancelled" : "/?authError=google_failed";
    } else {
      const code = requireString(url.searchParams.get("code"), "code", 4096);
      const result = await callGas("googleCallback", { code, state, redirectUri }, "", env, { requestId });
      session = requireSessionResult(result.data);
      finalLocation = "/";
    }
  } catch {
    finalLocation = "/?authError=google_failed";
    session = null;
  }
  headers.append("Location", finalLocation);
  headers.append("Set-Cookie", clearCookie(OAUTH_COOKIE));
  if (session) headers.append("Set-Cookie", serializeCookie(SESSION_COOKIE, session.token, SESSION_TTL_SECONDS));
  return new Response(null, { status: 303, headers });
}
__name(googleCallbackRoute, "googleCallbackRoute");
async function logoutRoute(context) {
  await requireMutation(context);
  const body = await readOptionalEmptyJson(context.request);
  onlyKeys(body, [], []);
  const token = getSessionToken(readCookies(context.request));
  if (!token) {
    return jsonResponse({ success: true, data: true, requestId: context.requestId }, 200, {
      cookies: logoutCookies()
    });
  }
  await revokeQueueLeaseBestEffort(context.env, token);
  try {
    const result = await callGas("logout", {}, token, context.env, { requestId: context.requestId });
    return jsonResponse({ success: true, data: result.data, requestId: context.requestId }, 200, {
      cookies: logoutCookies()
    });
  } catch (error2) {
    const safeError = error2 instanceof ApiError ? error2 : new ApiError("INTERNAL_ERROR", "The request could not be completed.");
    return jsonResponse({
      success: false,
      error: { code: safeError.code, message: safeError.message },
      requestId: context.requestId
    }, safeError.status, { cookies: logoutCookies() });
  }
}
__name(logoutRoute, "logoutRoute");
function logoutCookies() {
  return [
    { name: SESSION_COOKIE, value: clearCookie(SESSION_COOKIE) },
    { name: CSRF_COOKIE, value: clearCookie(CSRF_COOKIE) }
  ];
}
__name(logoutCookies, "logoutCookies");
async function activateRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["id", "active"], ["active"]);
  if (Object.hasOwn(body, "id") && body.id !== context.id) throw validationError();
  if (typeof body.active !== "boolean") throw validationError();
  const result = await callGas("activate", { id: context.id, active: body.active }, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(activateRoute, "activateRoute");
async function createTempUserRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["id", "name"], ["id", "name"]);
  if (!isUuid(body.id)) throw validationError("Invalid id.");
  const name = requireString(body.name, "name", 80);
  if (!name.trim()) throw validationError("Invalid name.");
  const result = await callGas("createTempUser", { id: body.id, name }, token, context.env, { requestId: context.requestId });
  return success(result, 201);
}
__name(createTempUserRoute, "createTempUserRoute");
async function previewTempUserAssignmentRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["targetUserId"], ["targetUserId"]);
  if (!isUuid(body.targetUserId)) throw validationError("Invalid targetUserId.");
  const result = await callGas("previewTempUserAssignment", {
    id: context.id,
    targetUserId: body.targetUserId
  }, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(previewTempUserAssignmentRoute, "previewTempUserAssignmentRoute");
async function assignTempUserRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["targetUserId"], ["targetUserId"]);
  if (!isUuid(body.targetUserId)) throw validationError("Invalid targetUserId.");
  const result = await callGas("assignTempUser", {
    id: context.id,
    targetUserId: body.targetUserId
  }, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(assignTempUserRoute, "assignTempUserRoute");
async function settingsRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["clientId", "clientSecret"], ["clientId"]);
  const clientId = requireString(body.clientId, "clientId", 200, true);
  const params = { clientId };
  if (Object.hasOwn(body, "clientSecret")) {
    params.clientSecret = requireString(body.clientSecret, "clientSecret", 300, true);
  }
  const result = await callGas("settings", params, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(settingsRoute, "settingsRoute");
async function passwordRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["old", "password"], ["old", "password"]);
  const old = requireString(body.old, "old", 72);
  const password = requireString(body.password, "password", 72);
  if (!old || password.length < 10) throw validationError();
  const result = await callGas("password", { old, password }, token, context.env, { requestId: context.requestId });
  await revokeQueueLeaseBestEffort(context.env, token);
  return sessionResult(result, context.requestId, context.env);
}
__name(passwordRoute, "passwordRoute");
async function createNoteRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  const params = validateNote(body, false);
  const queued = await enqueueQueueMutation(context, token, "createNote", params);
  if (queued) return queued;
  const result = await callGas("createNote", params, token, context.env, { requestId: context.requestId });
  return success(result, 201);
}
__name(createNoteRoute, "createNoteRoute");
async function noteItemRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  if (context.request.method === "DELETE") {
    const body2 = await readJsonObject(context.request);
    onlyKeys(body2, ["id", "revision"], ["revision"]);
    if (Object.hasOwn(body2, "id") && body2.id !== context.id) throw validationError();
    const revision = requireRevision(body2.revision);
    const params2 = { id: context.id, revision };
    const queued2 = await enqueueQueueMutation(context, token, "deleteNote", params2);
    if (queued2) return queued2;
    const result2 = await callGas("deleteNote", params2, token, context.env, { requestId: context.requestId });
    return success(result2, 200);
  }
  const body = await readJsonObject(context.request);
  if (body.id !== context.id) throw validationError();
  const params = validateNote(body, true);
  const queued = await enqueueQueueMutation(context, token, "updateNote", params);
  if (queued) return queued;
  const result = await callGas("updateNote", params, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(noteItemRoute, "noteItemRoute");
async function paymentRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["id", "userId", "paid", "revision"], ["paid", "revision"]);
  if (Object.hasOwn(body, "id") && body.id !== context.id) throw validationError();
  if (Object.hasOwn(body, "userId") && body.userId !== context.userId) throw validationError();
  if (typeof body.paid !== "boolean") throw validationError();
  const params = { id: context.id, userId: context.userId, paid: body.paid, revision: requireRevision(body.revision) };
  const queued = await enqueueQueueMutation(context, token, "payment", params);
  if (queued) return queued;
  const result = await callGas("payment", params, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(paymentRoute, "paymentRoute");
async function batchPaymentRoute(context) {
  await requireMutation(context);
  const token = requireSession(context.request);
  const body = await readJsonObject(context.request);
  onlyKeys(body, ["id", "userId", "items"], ["id", "userId", "items"]);
  if (!isUuid(body.id) || !isUuid(body.userId)) throw validationError();
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    throw validationError("A payment batch must contain between 1 and 50 notes.");
  }
  const seen = /* @__PURE__ */ new Set();
  const items = body.items.map((item) => {
    if (!isPlainObject3(item)) throw validationError();
    onlyKeys(item, ["id", "revision"], ["id", "revision"]);
    if (!isUuid(item.id) || seen.has(item.id.toLowerCase())) throw validationError();
    seen.add(item.id.toLowerCase());
    return { id: item.id, revision: requireRevision(item.revision) };
  });
  const params = {
    id: body.id,
    userId: body.userId,
    items
  };
  const queued = await enqueueQueueMutation(context, token, "batchPayment", params);
  if (queued) return queued;
  const result = await callGas("batchPayment", params, token, context.env, { requestId: context.requestId });
  return success(result, 200);
}
__name(batchPaymentRoute, "batchPaymentRoute");
function validateNote(body, updating) {
  const required = ["id", "title", "date", "total", "category", "payerId", "detail", "userIds", "mode"];
  const allowed = [...NOTE_FIELDS, ...updating ? ["revision"] : []];
  onlyKeys(body, allowed, [...required, ...updating ? ["revision"] : []]);
  if (!isUuid(body.id) || !isUuid(body.payerId)) throw validationError();
  requireString(body.title, "title", 160);
  if (!body.title.trim()) throw validationError();
  requireString(body.date, "date", 30);
  requireString(body.detail, "detail", 2e3, true);
  requireInteger(body.total, "total", 0, 1e11);
  if (!USER_CATEGORIES.has(body.category)) throw validationError();
  if (!Array.isArray(body.userIds) || body.userIds.length < 1 || body.userIds.length > 200) throw validationError();
  const seen = /* @__PURE__ */ new Set();
  for (const id of body.userIds) {
    if (!isUuid(id) || seen.has(id)) throw validationError();
    seen.add(id);
  }
  if (!["equal", "fixed", "custom"].includes(body.mode)) throw validationError();
  if (Object.hasOwn(body, "unit") && ![1, 1e3, 1e4].includes(body.unit)) throw validationError();
  if (Object.hasOwn(body, "pinnedAmounts")) validateAmountMap(body.pinnedAmounts);
  if (Object.hasOwn(body, "fixed")) requireInteger(body.fixed, "fixed", 0, 1e11);
  if (Object.hasOwn(body, "amounts")) validateAmountMap(body.amounts);
  const params = {};
  for (const field of NOTE_FIELDS) {
    if (!NOTE_OPTIONAL_FIELDS.includes(field) || Object.hasOwn(body, field)) params[field] = body[field];
  }
  if (updating) params.revision = requireRevision(body.revision);
  return params;
}
__name(validateNote, "validateNote");
function validateAmountMap(value) {
  if (!isPlainObject3(value) || Object.keys(value).length > ID_MAP_LIMIT) throw validationError();
  for (const [id, amount] of Object.entries(value)) {
    if (!isUuid(id)) throw validationError();
    requireInteger(amount, "amount", 0, 1e11);
  }
}
__name(validateAmountMap, "validateAmountMap");
async function requireMutation({ request, url, env }) {
  rejectQuery(url);
  const canonicalOrigin = appOrigin(request, env);
  if (request.headers.get("Origin") !== canonicalOrigin) {
    throw new ApiError("FORBIDDEN", "Request origin could not be verified.");
  }
  if (!/^(?:application\/json)(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) {
    throw validationError("Content-Type must be application/json.");
  }
  const cookies = readCookies(request);
  const seed = cookieValue(cookies, CSRF_COOKIE);
  const csrfToken = request.headers.get("X-CSRF-Token");
  if (!seed || !/^[A-Za-z0-9_-]{43}$/.test(seed)) {
    throw new ApiError("FORBIDDEN", "Request could not be verified.");
  }
  const secret = requireSessionSecret(env);
  const sessionToken = getSessionToken(cookies);
  if (!await verifyCsrfToken(csrfToken, seed, sessionToken, secret)) {
    throw new ApiError("FORBIDDEN", "Request could not be verified.");
  }
}
__name(requireMutation, "requireMutation");
function requireSession(request) {
  const token = getSessionToken(readCookies(request));
  if (!token) throw new ApiError("UNAUTHENTICATED", "Please sign in to continue.");
  return token;
}
__name(requireSession, "requireSession");
async function readJsonObject(request) {
  const text = await readTextLimited3(request, MAX_BROWSER_BODY_BYTES);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw validationError("Request body must be valid JSON.");
  }
  if (!isPlainObject3(body)) throw validationError();
  return body;
}
__name(readJsonObject, "readJsonObject");
async function readOptionalEmptyJson(request) {
  const text = await readTextLimited3(request, MAX_BROWSER_BODY_BYTES);
  if (!text.trim()) return {};
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw validationError("Request body must be valid JSON.");
  }
  if (!isPlainObject3(body)) throw validationError();
  return body;
}
__name(readOptionalEmptyJson, "readOptionalEmptyJson");
async function readTextLimited3(request, maxBytes) {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ApiError("VALIDATION_ERROR", "Request body is too large.", 413);
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError("VALIDATION_ERROR", "Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw validationError("Request body must be UTF-8 JSON.");
  }
}
__name(readTextLimited3, "readTextLimited");
async function sessionResult(result, requestId, env) {
  const session = requireSessionResult(result.data);
  await syncQueueAuthorizationBestEffort(env, session.token, session.user);
  return jsonResponse({ success: true, data: { user: session.user }, requestId }, 200, {
    cookies: [{ name: SESSION_COOKIE, value: serializeCookie(SESSION_COOKIE, session.token, SESSION_TTL_SECONDS) }]
  });
}
__name(sessionResult, "sessionResult");
function requireSessionResult(value) {
  if (!isPlainObject3(value) || !isSessionToken(value.token) || !isPlainObject3(value.user)) {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid session.");
  }
  const user = value.user;
  if (!isUuid(user.id) || typeof user.name !== "string" || user.name.length > 80 || typeof user.username !== "string" || user.username.length > 40 || typeof user.email !== "string" || user.email.length > 320 || typeof user.active !== "boolean" || !["admin", "member"].includes(user.role)) {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid session.");
  }
  return {
    token: value.token,
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      active: user.active,
      role: user.role
    }
  };
}
__name(requireSessionResult, "requireSessionResult");
function validateGoogleAuthorizationUrl(value, redirectUri) {
  if (typeof value !== "string" || value.length > 8192) {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid sign-in URL.");
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid sign-in URL.");
  }
  const state = url.searchParams.get("state");
  if (url.protocol !== "https:" || url.hostname !== "accounts.google.com" || url.port || url.username || url.password || url.pathname !== "/o/oauth2/v2/auth" || url.hash || !state || !/^[A-Za-z0-9._~-]{32,512}$/.test(state) || url.searchParams.getAll("state").length !== 1 || url.searchParams.get("redirect_uri") !== redirectUri || url.searchParams.getAll("redirect_uri").length !== 1 || url.searchParams.get("response_type") !== "code" || url.searchParams.getAll("response_type").length !== 1) {
    throw new ApiError("INTERNAL_ERROR", "Backend returned an invalid sign-in URL.");
  }
  return url;
}
__name(validateGoogleAuthorizationUrl, "validateGoogleAuthorizationUrl");
function validateCallbackQuery(url) {
  const allowed = /* @__PURE__ */ new Set(["code", "state", "error", "error_description", "scope", "authuser", "prompt", "iss"]);
  for (const key2 of url.searchParams.keys()) {
    if (!allowed.has(key2)) throw validationError("OAuth callback parameters are invalid.");
    if (url.searchParams.getAll(key2).length !== 1) throw validationError("OAuth callback parameters are invalid.");
  }
  const issuer = url.searchParams.get("iss");
  if (issuer !== null && issuer !== "https://accounts.google.com") {
    throw validationError("OAuth callback issuer is invalid.");
  }
  const state = url.searchParams.get("state");
  if (!state || !/^[A-Za-z0-9._~-]{32,512}$/.test(state)) {
    throw validationError("OAuth callback could not be verified.");
  }
  const code = url.searchParams.get("code");
  const error2 = url.searchParams.get("error");
  if (!code && !error2 || code && error2 || code && code.length > 4096 || error2 && error2.length > 128) {
    throw validationError("OAuth callback parameters are invalid.");
  }
}
__name(validateCallbackQuery, "validateCallbackQuery");
function callbackUri(request, env) {
  return `${appOrigin(request, env)}/api/auth/google/callback`;
}
__name(callbackUri, "callbackUri");
function appOrigin(request, env) {
  const configured = env.APP_ORIGIN;
  const source = typeof configured === "string" && configured ? configured : new URL(request.url).origin;
  let url;
  try {
    url = new URL(source);
  } catch {
    throw new ApiError("CONFIGURATION_ERROR", "Application origin is not configured.");
  }
  if (!["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && !isLocalhost(url.hostname) || url.username || url.password || url.port && url.port !== "443" && !(url.protocol === "http:" && isLocalhost(url.hostname)) || url.pathname !== "/" || url.search || url.hash) {
    throw new ApiError("CONFIGURATION_ERROR", "Application origin is not configured.");
  }
  return url.origin;
}
__name(appOrigin, "appOrigin");
function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
__name(isLocalhost, "isLocalhost");
function rejectQuery(url) {
  if (url.search) throw validationError("Unexpected query parameters.");
}
__name(rejectQuery, "rejectQuery");
function decodeRouteId(rawId) {
  let value;
  try {
    value = decodeURIComponent(rawId);
  } catch {
    throw validationError("Route identifier is invalid.");
  }
  if (!UUID3.test(value)) throw validationError("Route identifier is invalid.");
  return value;
}
__name(decodeRouteId, "decodeRouteId");
function onlyKeys(value, allowed, required) {
  const set = new Set(allowed);
  if (Object.keys(value).some((key2) => !set.has(key2))) throw validationError();
  if (required.some((key2) => !Object.hasOwn(value, key2))) throw validationError();
}
__name(onlyKeys, "onlyKeys");
function requireString(value, field, maxLength, allowEmpty = false) {
  if (typeof value !== "string" || value.length > maxLength || !allowEmpty && value.length === 0) throw validationError(`Invalid ${field}.`);
  return value;
}
__name(requireString, "requireString");
function requireInteger(value, field, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw validationError(`Invalid ${field}.`);
  }
  return value;
}
__name(requireInteger, "requireInteger");
function requireRevision(value) {
  return requireInteger(value, "revision", 1, Number.MAX_SAFE_INTEGER);
}
__name(requireRevision, "requireRevision");
function validationError(message = "Request parameters are invalid.") {
  return new ApiError("VALIDATION_ERROR", message);
}
__name(validationError, "validationError");
function success(result, status) {
  return jsonResponse({ success: true, data: result.data, requestId: result.requestId }, status);
}
__name(success, "success");
function jsonResponse(body, status, options = {}) {
  const headers = baseHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (options.allow) headers.set("Allow", options.allow);
  for (const cookie of options.cookies || []) headers.append("Set-Cookie", cookie.value);
  return new Response(JSON.stringify(body), { status, headers });
}
__name(jsonResponse, "jsonResponse");
function baseHeaders() {
  return new Headers({
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  });
}
__name(baseHeaders, "baseHeaders");
function routeMethods(request) {
  const url = new URL(request.url);
  return resolveRoute(url.pathname)?.methods.join(", ") || "GET";
}
__name(routeMethods, "routeMethods");
function safeCacheState(value) {
  return ["MISS", "REVALIDATED", "BYPASS", "NONE"].includes(value) ? value : "NONE";
}
__name(safeCacheState, "safeCacheState");
function writeQueueCapability(env) {
  try {
    return typeof env?.WRITE_OUTBOX?.getByName === "function" ? "enabled" : "disabled";
  } catch {
    return "disabled";
  }
}
__name(writeQueueCapability, "writeQueueCapability");
function isSafeMilliseconds(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
__name(isSafeMilliseconds, "isSafeMilliseconds");
function isPlainObject3(value) {
  return !!value && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
__name(isPlainObject3, "isPlainObject");

// src/index.js
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isApiPath(url.pathname)) return handleApiRequest(request, env);
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    });
  }
};

// src/outbox-object.js
import { DurableObject } from "cloudflare:workers";
var WriteOutbox = class extends DurableObject {
  static {
    __name(this, "WriteOutbox");
  }
  constructor(ctx, env) {
    super(ctx, env);
    this.engine = new OutboxEngine(ctx.storage, env);
    ctx.blockConcurrencyWhile(async () => {
      this.engine.init();
    });
  }
  authorize(input) {
    return this.engine.authorize(input);
  }
  revoke(input) {
    return this.engine.revoke(input);
  }
  enqueue(input) {
    return this.engine.enqueue(input);
  }
  async list(input) {
    try {
      await this.engine.ensureWakeup();
    } catch {
    }
    return this.engine.list(input);
  }
  get(input) {
    return this.engine.get(input);
  }
  alarm() {
    return this.engine.alarm();
  }
};
export {
  WriteOutbox,
  index_default as default
};
//# sourceMappingURL=entrypoint.js.map
