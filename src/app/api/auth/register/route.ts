import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/username";
import { normalizeInviteCode } from "@/lib/invite";

/**
 * Registration runs server-side because two things need the service role:
 * creating the account with its email pre-confirmed (members sign in with a
 * username, and there is no inbox behind the synthetic address), and writing
 * the admin-readable credential mirror.
 *
 * The signup bonus and the referral link are attached by the
 * `on_auth_user_created` trigger, which reads the metadata set here.
 */
export async function POST(request: Request) {
  let body: { name?: unknown; username?: unknown; password?: unknown; invite?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const fullName = String(body.name ?? "").trim().slice(0, 80);
  const username = normalizeUsername(String(body.username ?? ""));
  const password = String(body.password ?? "");
  const invite = normalizeInviteCode(String(body.invite ?? ""));

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Enter your names." }, { status: 400 });
  }
  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters: letters, numbers, dots or underscores." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Registration is not configured on this deployment." },
      { status: 500 },
    );
  }

  const { data: available } = await admin.rpc("username_available", { _username: username });
  if (available === false) {
    return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username,
      invite_code: invite,
      ref: invite,
    },
  });

  if (error || !created.user) {
    const message = error?.message ?? "Could not create the account.";
    const taken = /already|exists|registered/i.test(message);
    return NextResponse.json(
      { error: taken ? "That username is already taken." : message },
      { status: taken ? 409 : 400 },
    );
  }

  // Support-visible credential mirror. Service role only: `user_secrets` has no
  // row level policies, so no member session can ever read it.
  await admin
    .from("user_secrets")
    .upsert(
      { user_id: created.user.id, password, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  // The trigger already built the profile; this covers a database where the
  // trigger is missing and also returns the member's own code immediately.
  const { data: profile } = await admin
    .from("profiles")
    .select("referral_code")
    .eq("id", created.user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    username,
    email: usernameToEmail(username),
    referralCode: profile?.referral_code ?? null,
  });
}
