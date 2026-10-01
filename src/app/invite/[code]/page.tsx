import type { Metadata } from "next";
import { InviteLanding } from "./invite-landing";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME, SITE_URL } from "@/lib/platform";
import { normalizeInviteCode } from "@/lib/invite";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const invite = normalizeInviteCode(code) || code.toUpperCase().slice(0, 10);
  const title = `Join ${BRAND_NAME} with code ${invite}`;
  const description =
    "Activate a coffee processing plant and collect your returns at 10PM every day for 20 days.";

  return {
    title,
    description,
    // The invite route renders its own branded card via opengraph-image.tsx.
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/invite/${invite}`,
      siteName: BRAND_NAME,
      type: "website",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = normalizeInviteCode(code);

  // Show the inviter's name so the landing page feels personal and verifiable.
  let inviterName: string | null = null;
  if (invite) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.rpc("invite_preview", { _code: invite });
      const payload = (typeof data === "string" ? JSON.parse(data) : data) as {
        ok?: boolean;
        name?: string;
      } | null;
      if (payload?.ok) inviterName = payload.name ?? null;
    } catch {
      // A missing or unreachable database just means a generic landing page.
    }
  }

  return <InviteLanding code={invite} inviterName={inviterName} />;
}
