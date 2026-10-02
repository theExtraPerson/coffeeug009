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
  const poseidon = profiles.find((p) => p.username === "poseidon");
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const refs = await get("referrals?select=referrer_id,referee_id,referral_code,created_at");
  const usersRes = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers });
  const usersBody = await usersRes.json();
  const users = usersBody.users ?? usersBody;
  const meta = (users ?? []).map((u) => ({
    id: u.id,
    username: u.user_metadata?.username ?? byId[u.id]?.username,
    invite: u.user_metadata?.invite_code || u.user_metadata?.invite || u.user_metadata?.ref || "",
    created: u.created_at,
  }));
  const direct = profiles.filter((p) => p.referred_by === poseidon?.id);
  const viaRef = refs.filter((r) => r.referrer_id === poseidon?.id);
  const usedCode = meta.filter(
    (m) => String(m.invite).toUpperCase() === String(poseidon?.referral_code ?? "").toUpperCase() && m.invite,
  );
  console.log(JSON.stringify({
    poseidon: poseidon
      ? { id: poseidon.id.slice(0, 8), code: poseidon.referral_code, created: poseidon.created_at }
      : null,
    profileCount: profiles.length,
    directCount: direct.length,
    referralRowCount: viaRef.length,
    metadataMatches: usedCode.map((m) => ({
      username: m.username,
      invite: m.invite,
      linked: byId[m.id]?.referred_by ? byId[byId[m.id].referred_by]?.username : null,
    })),
    firstFive: profiles.slice(0, 8).map((p) => ({
      username: p.username,
      code: p.referral_code,
      upline: p.referred_by ? byId[p.referred_by]?.username : null,
    })),
    invitesSaved: meta.filter((m) => m.invite).map((m) => ({
      username: m.username,
      invite: m.invite,
      upline: byId[m.id]?.referred_by ? byId[byId[m.id].referred_by]?.username : null,
    })),
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
