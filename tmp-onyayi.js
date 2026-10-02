const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

async function main() {
  const env = loadEnv(path.join(process.cwd(), ".env.local"));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  async function get(p) {
    const res = await fetch(`${url}/rest/v1/${p}`, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }
  const profiles = await get(
    "profiles?select=id,username,full_name,referral_code,referred_by,created_at&order=created_at.asc",
  );
  const owner = profiles.find((p) => p.username === "onyayit25");
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const refs = await get("referrals?select=referrer_id,referee_id,referral_code,created_at");
  const usersRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers });
  const usersBody = await usersRes.json();
  const users = usersBody.users ?? [];
  const code = String(owner.referral_code).toUpperCase();
  const directIds = new Set(
    profiles.filter((p) => p.referred_by === owner.id).map((p) => p.id),
  );
  for (const r of refs) if (r.referrer_id === owner.id) directIds.add(r.referee_id);
  const level1 = [...directIds].map((id) => byId[id]).filter(Boolean);
  const level2 = profiles.filter((p) => directIds.has(p.referred_by) || refs.some((r) => r.referee_id === p.id && directIds.has(r.referrer_id)));
  const meta = users.map((u) => ({
    id: u.id,
    username: u.user_metadata?.username ?? byId[u.id]?.username ?? null,
    invite: String(u.user_metadata?.invite_code || u.user_metadata?.invite || u.user_metadata?.ref || "").toUpperCase(),
    linked: byId[u.id]?.referred_by ? byId[byId[u.id].referred_by]?.username ?? "missing-profile" : null,
    hasProfile: Boolean(byId[u.id]),
  }));
  const usedHisCode = meta.filter((m) => m.invite === code);
  const unlinked = usedHisCode.filter((m) => m.linked !== "onyayit25");
  console.log(JSON.stringify({
    code,
    profiles: profiles.length,
    level1: level1.map((p) => p.username),
    level2: level2.map((p) => ({ username: p.username, via: byId[p.referred_by]?.username })),
    usedHisCode: usedHisCode.map((m) => ({ username: m.username, linked: m.linked, hasProfile: m.hasProfile })),
    unlinked,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
