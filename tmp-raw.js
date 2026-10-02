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
  const usersBody = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, { headers }).then((r) => r.json());
  const rows = (usersBody.users ?? []).map((u) => ({
    username: u.user_metadata?.username,
    invite_code: u.user_metadata?.invite_code ?? null,
    ref: u.user_metadata?.ref ?? null,
    invite: u.user_metadata?.invite ?? null,
  }));
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
