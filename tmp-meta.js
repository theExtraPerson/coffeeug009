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
  const profiles = await fetch(
    `${url}/rest/v1/profiles?select=id,username,referral_code,referred_by,created_at&order=created_at.asc`,
    { headers },
  ).then((r) => r.json());
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const codes = new Map(profiles.map((p) => [String(p.referral_code).toUpperCase(), p.username]));
  const usersBody = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers }).then((r) => r.json());
  const rows = (usersBody.users ?? []).map((u) => {
    const meta = { ...(u.user_metadata ?? {}) };
    delete meta.password;
    const invite = String(meta.invite_code || meta.invite || meta.ref || "");
    const owner = codes.get(invite.toUpperCase()) ?? null;
    return {
      username: meta.username ?? byId[u.id]?.username,
      created: u.created_at,
      invite: invite || null,
      codeOwner: owner,
      referredBy: byId[u.id]?.referred_by ? byId[byId[u.id].referred_by]?.username : null,
      ownCode: byId[u.id]?.referral_code ?? null,
      metaKeys: Object.keys(meta),
    };
  });
  rows.sort((a, b) => String(a.created).localeCompare(String(b.created)));
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
