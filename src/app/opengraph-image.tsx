import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "CoffeeUG — Grow, Export, Prosper";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default link preview: the logo on the dark app background. */
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo.jpg"));
  const logoSrc = `data:image/jpeg;base64,${Buffer.from(logo).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          backgroundColor: "#F6F3E8",
          backgroundImage:
            "radial-gradient(90% 42% at 100% -8%, rgba(228,194,0,0.28) 0%, transparent 58%), linear-gradient(#FBF8F0 0%, #E7F2E6 100%)",
          color: "#14331F",
        }}
      >
        <img src={logoSrc} width={300} height={300} alt="" style={{ borderRadius: 150 }} />
        <div style={{ fontSize: 64, fontWeight: 700 }}>CoffeeUG</div>
        <div style={{ fontSize: 26, letterSpacing: 6, color: "#4D6B58" }}>
          GROW · EXPORT · PROSPER
        </div>
        <div style={{ fontSize: 24, color: "#146C34" }}>
          Real coffee, real income · 10% daily for 20 days
        </div>
      </div>
    ),
    { ...size },
  );
}
