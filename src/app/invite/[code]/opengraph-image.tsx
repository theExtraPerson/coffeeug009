import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "CoffeeUG invitation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Branded share card for an invite link, so the CoffeeUG logo and the code show
 * up wherever a member pastes their link.
 */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = (code || "").trim().toUpperCase().slice(0, 10);
  const logo = await readFile(join(process.cwd(), "public/brand/logo.jpg"));
  const logoSrc = `data:image/jpeg;base64,${Buffer.from(logo).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F6F3E8",
          backgroundImage:
            "radial-gradient(90% 42% at 100% -8%, rgba(228,194,0,0.28) 0%, transparent 58%), linear-gradient(#FBF8F0 0%, #E7F2E6 100%)",
        }}
      >
        {/* Same gradient card and inset hairline the app uses. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 48,
            padding: 56,
            backgroundImage: "linear-gradient(#FFFCF6, #F7F4EA)",
            border: "1px solid #D5E3D2",
            borderRadius: 36,
            width: 1104,
            height: 534,
          }}
        >
          <img src={logoSrc} width={360} height={360} alt="" style={{ borderRadius: 180 }} />
          <div style={{ display: "flex", flexDirection: "column", color: "#14331F" }}>
            <div style={{ fontSize: 58, fontWeight: 700 }}>CoffeeUG</div>
            <div style={{ fontSize: 24, color: "#4D6B58", marginTop: 8, letterSpacing: 4 }}>
              GROW · EXPORT · PROSPER
            </div>
            <div style={{ marginTop: 28, fontSize: 22, color: "#4D6B58" }}>
              Join with referral code
            </div>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                letterSpacing: 8,
                color: "#146C34",
                marginTop: 8,
              }}
            >
              {invite}
            </div>
            <div style={{ marginTop: 24, fontSize: 22, color: "#1B4332" }}>
              10% daily for 20 days · paid at 10PM
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
