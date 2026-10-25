// src/banks.mjs
var BANKS = Object.freeze([
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970422", name: "MBBank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" }
].map(Object.freeze));
var bankFor = (bin) => BANKS.find((bank) => bank.bin === bin) || null;

// src/profile.mjs
var ProfileError = class extends Error {
  constructor(code) {
    super(code);
    this.name = "ProfileError";
    this.code = code;
  }
};
var fail = (code) => {
  throw new ProfileError(code);
};
function profileUsername(value) {
  return typeof value === "string" && value.length <= 40 && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
}
function validateProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !["bankBin", "accountNumber", "accountName"].includes(key))) fail("INVALID_PROFILE");
  if (!bankFor(value.bankBin) || typeof value.accountNumber !== "string" || !/^[A-Za-z0-9]{1,19}$/.test(value.accountNumber)) fail("INVALID_PROFILE");
  if (value.accountName !== void 0 && (typeof value.accountName !== "string" || value.accountName.trim().length > 80 || /[\u0000-\u001f\u007f<>]/.test(value.accountName))) fail("INVALID_PROFILE");
  return Object.freeze({ bankBin: value.bankBin, accountNumber: value.accountNumber, nameVerified: false });
}
var shareKeys = /* @__PURE__ */ new Set(["userId", "amount", "paid", "confirmedBy", "paidAt", "paymentBatchId"]);
function isCurrentUnpaidDebtor(notes, actorId, ownerId) {
  if (actorId === ownerId || !Array.isArray(notes)) return false;
  const latest = /* @__PURE__ */ new Map(), conflicts = /* @__PURE__ */ new Set();
  for (const note of notes) {
    if (!note || typeof note.id !== "string" || !Number.isSafeInteger(note.revision) || note.revision < 0) continue;
    const old = latest.get(note.id);
    if (!old || note.revision > old.revision) {
      latest.set(note.id, note);
      conflicts.delete(note.id);
    } else if (note.revision === old.revision && JSON.stringify(note) !== JSON.stringify(old)) conflicts.add(note.id);
  }
  return [...latest.values()].some((note) => {
    if (conflicts.has(note.id) || note.deleted === true || note.deleted !== void 0 && typeof note.deleted !== "boolean" || note.payerId !== ownerId || !Array.isArray(note.allocations)) return false;
    const own = note.allocations.filter((share2) => share2?.userId === actorId);
    if (!own.length || own.some((share2) => JSON.stringify(share2) !== JSON.stringify(own[0]))) return false;
    const share = own[0];
    return share.paid === false && Number.isSafeInteger(share.amount) && share.amount > 0 && Object.keys(share).every((key) => shareKeys.has(key));
  });
}
function createProfileService({ store, authenticate, authorizedNotes, now = Date.now }) {
  if (!store?.read || !store.compareAndSet || !authenticate || !authorizedNotes) fail("CONFIGURATION_REQUIRED");
  async function actor(token) {
    const user = await authenticate(token);
    if (!user?.id) fail("UNAUTHENTICATED");
    if (user.active !== true) fail("FORBIDDEN");
    return user;
  }
  function publicProfile(record) {
    if (!record) return null;
    const fields = validateProfile({ bankBin: record.bankBin, accountNumber: record.accountNumber, accountName: record.accountName });
    if (!Number.isSafeInteger(record.revision) || record.revision < 1) fail("INVALID_PROFILE");
    return { ...fields, ownerId: record.ownerId, revision: record.revision, updatedAt: record.updatedAt };
  }
  return Object.freeze({
    async read(token, requestedOwner) {
      const user = await actor(token), ownerId = requestedOwner || user.id;
      if (typeof ownerId !== "string" || !ownerId || ownerId.length > 128) fail("NOT_FOUND");
      if (ownerId !== user.id && !isCurrentUnpaidDebtor(await authorizedNotes(user), user.id, ownerId)) fail("NOT_FOUND");
      const record = await store.read(ownerId);
      if (!record) {
        if (ownerId === user.id) return null;
        fail("NOT_FOUND");
      }
      if (record.ownerId !== ownerId) fail("NOT_FOUND");
      return publicProfile(record);
    },
    async save(token, body) {
      const user = await actor(token);
      if (!body || typeof body !== "object" || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) fail("INVALID_PROFILE");
      const { expectedRevision, ...draft } = body, profile = validateProfile(draft);
      const next = { schemaVersion: 1, ownerId: user.id, username: profileUsername(user.username), bankBin: profile.bankBin, accountNumber: profile.accountNumber, revision: expectedRevision + 1, updatedAt: now() };
      if (!Number.isSafeInteger(next.revision) || !await store.compareAndSet(user.id, expectedRevision, next)) fail("CONFLICT");
      return publicProfile(next);
    }
  });
}

// src/r2-store.mjs
var PROFILE_SCOPE = "example-bank-profile-scope-v1";
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var fail2 = (code) => {
  throw new ProfileError(code);
};
function createR2ProfileStore(bucket, scope) {
  if (!bucket?.get || !bucket?.put || scope !== PROFILE_SCOPE) fail2("CONFIGURATION_REQUIRED");
  const key = (id) => {
    if (!UUID.test(id)) fail2("INVALID_PROFILE");
    return `rpa_qr/${id.toLowerCase()}.json`;
  };
  async function load(id) {
    const object = await bucket.get(key(id));
    if (!object) return null;
    if (!Number.isSafeInteger(object.size) || object.size > 4096 || typeof object.etag !== "string") fail2("INVALID_PROFILE");
    let record;
    try {
      record = JSON.parse(await object.text());
    } catch {
      fail2("INVALID_PROFILE");
    }
    if (!record || record.schemaVersion !== 1 || record.appScope !== scope || record.ownerId !== id || !Number.isSafeInteger(record.revision) || record.revision < 1 || !Number.isSafeInteger(record.updatedAt) || record.updatedAt < 0) fail2("INVALID_PROFILE");
    if (Object.keys(record).some((k) => !["schemaVersion", "appScope", "ownerId", "username", "bankBin", "accountNumber", "accountName", "revision", "updatedAt"].includes(k))) fail2("INVALID_PROFILE");
    if (record.username !== void 0 && record.username !== null && profileUsername(record.username) !== record.username) fail2("INVALID_PROFILE");
    validateProfile({ bankBin: record.bankBin, accountNumber: record.accountNumber, accountName: record.accountName });
    return { record, etag: object.etag };
  }
  return Object.freeze({
    async read(id) {
      return (await load(id))?.record || null;
    },
    async compareAndSet(id, revision, next) {
      const previous = await load(id);
      if ((previous?.record.revision || 0) !== revision) return false;
      if (next.ownerId !== id || next.revision !== revision + 1) fail2("INVALID_PROFILE");
      const record = { ...next, appScope: scope };
      const onlyIf = new Headers(previous ? { "If-Match": `"${previous.etag}"` } : { "If-None-Match": "*" });
      const result = await bucket.put(key(id), JSON.stringify(record), { onlyIf, httpMetadata: { contentType: "application/json", cacheControl: "no-store" } });
      return result !== null;
    }
  });
}

// src/server.mjs
var fail3 = (code) => {
  throw new ProfileError(code);
};
var validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T12:00:00Z")) && (/* @__PURE__ */ new Date(s + "T12:00:00Z")).toISOString().slice(0, 10) === s;
var normalize = (x) => Array.isArray(x) ? x.map(normalize) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalize(v)])) : x;
var stable = (x) => JSON.stringify(normalize(x));
function filterAuthorizedDebtNotes(data, actor, start, end, owner, scope = "all") {
  if (!data || data.user?.id !== actor.id || data.user?.active !== true || !Array.isArray(data.notes) || !Array.isArray(data.users)) fail3("UPSTREAM_INVALID");
  const targets = data.users.filter((u) => u?.id === owner);
  if (targets.length !== 1 || targets[0].active !== true || targets[0].isTemporary || targets[0].assignedTo) fail3("NOT_FOUND");
  const notes = /* @__PURE__ */ new Map();
  for (const n of data.notes) {
    if (!n || !UUID.test(n.id) || !Number.isSafeInteger(n.revision) || n.revision < 0) fail3("UPSTREAM_INVALID");
    const old = notes.get(n.id);
    if (!old || n.revision > old.revision) notes.set(n.id, n);
    else if (n.revision === old.revision && stable(n) !== stable(old)) fail3("UPSTREAM_INVALID");
  }
  return [...notes.values()].filter((n) => {
    if (n.deleted === true) return false;
    if (n.deleted !== void 0 && typeof n.deleted !== "boolean") fail3("UPSTREAM_INVALID");
    const date = String(n.date || "").slice(0, 10);
    if (!validDate(date)) fail3("UPSTREAM_INVALID");
    if (date < start || date > end) return false;
    if (!UUID.test(n.payerId) || !Array.isArray(n.allocations)) fail3("UPSTREAM_INVALID");
    const ids = /* @__PURE__ */ new Set();
    for (const s of n.allocations) {
      if (!s || !UUID.test(s.userId) || ids.has(s.userId) || !Number.isSafeInteger(s.amount) || s.amount < 0 || typeof s.paid !== "boolean" || Object.keys(s).some((k) => !["userId", "amount", "paid", "confirmedBy", "paidAt", "paymentBatchId"].includes(k))) fail3("UPSTREAM_INVALID");
      ids.add(s.userId);
    }
    const person = scope === "me" ? actor.id : scope;
    return person === "all" || n.payerId === person || n.creatorId === person || n.allocations.some((s) => s.userId === person);
  });
}
function createBankProfileHandlers({ requireSession, requireMutation, readJsonObject, freshQueueActor, callGas }) {
  function reply(context, data, status = 200, code) {
    return new Response(JSON.stringify(code ? { success: false, error: { code, message: "Kh\xF4ng th\u1EC3 x\u1EED l\xFD h\u1ED3 s\u01A1 ng\xE2n h\xE0ng." }, requestId: context.requestId } : { success: true, data, requestId: context.requestId }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  async function handle(context, owner) {
    try {
      const { request, url, env, requestId } = context;
      let start, end, scope;
      if (owner) {
        if (!UUID.test(owner) || [...url.searchParams.keys()].some((k) => !["start", "end", "scope"].includes(k)) || url.searchParams.getAll("start").length !== 1 || url.searchParams.getAll("end").length !== 1) fail3("INVALID_PROFILE");
        scope = url.searchParams.get("scope") || "all";
        if (url.searchParams.getAll("scope").length > 1 || !(["all", "me"].includes(scope) || UUID.test(scope))) fail3("INVALID_PROFILE");
        start = url.searchParams.get("start");
        end = url.searchParams.get("end");
        if (!validDate(start) || !validDate(end) || start > end) fail3("INVALID_PROFILE");
      } else if (url.search) fail3("INVALID_PROFILE");
      if (request.method === "PUT") await requireMutation(context);
      const token = requireSession(request), actor = await freshQueueActor(token, env, requestId);
      if (!UUID.test(actor.id) || actor.active !== true || actor.isTemporary || actor.assignedTo) fail3("FORBIDDEN");
      if (request.headers.get("X-RPA-Actor") !== actor.id) fail3("FORBIDDEN");
      const store = createR2ProfileStore(env.BANK_PROFILES, env.BANK_PROFILE_SCOPE);
      let debtNotes;
      const service = createProfileService({ store, authenticate: async () => actor, authorizedNotes: async () => {
        const r = await callGas("data", { redirectUri: new URL("/api/auth/google/callback", env.APP_ORIGIN).href }, token, env, { requestId });
        debtNotes = filterAuthorizedDebtNotes(r.data, actor, start, end, owner, scope);
        return debtNotes;
      } });
      const data = request.method === "PUT" ? await service.save(token, await readJsonObject(request)) : await service.read(token, owner);
      if (owner && data) {
        if (owner === actor.id || !debtNotes) fail3("NOT_FOUND");
        let amount = 0n;
        for (const n of debtNotes) if (n.payerId === owner) {
          for (const share of n.allocations) if (share.userId === actor.id && share.userId !== n.payerId && share.paid === false) amount += BigInt(share.amount);
        }
        if (amount <= 0n) fail3("NOT_FOUND");
        return reply(context, { ...data, debtAmount: String(amount) });
      }
      return reply(context, data);
    } catch (error) {
      if (!(error instanceof ProfileError)) throw error;
      const code = error.code, mapping = { INVALID_PROFILE: [400, "VALIDATION_ERROR"], CONFLICT: [409, "CONFLICT"], NOT_FOUND: [404, "NOT_FOUND"], UNAUTHENTICATED: [401, "UNAUTHENTICATED"], FORBIDDEN: [403, "FORBIDDEN"], CONFIGURATION_REQUIRED: [503, "CONFIGURATION_ERROR"], UPSTREAM_INVALID: [502, "INTERNAL_ERROR"] };
      const [status, safeCode] = mapping[code] || [502, "INTERNAL_ERROR"];
      return reply(context, null, status, safeCode);
    }
  }
  return Object.freeze({ own: (context) => handle(context), creditor: (context, owner) => handle(context, owner) });
}
export {
  createBankProfileHandlers,
  filterAuthorizedDebtNotes
};
