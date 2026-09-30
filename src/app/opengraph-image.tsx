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
          backgroundColor: "#0B0C11",
          backgroundImage:
            "radial-gradient(115% 55% at 85% -8%, rgba(255,122,51,0.35) 0%, transparent 62%), radial-gradient(95% 45% at -15% 14%, rgba(122,102,255,0.28) 0%, transparent 58%), linear-gradient(#141521 0%, #0E0F16 55%, #0B0C11 100%)",
          color: "#F2F1F6",
        }}
      >
        <img src={logoSrc} width={300} height={300} alt="" style={{ borderRadius: 150 }} />
        <div style={{ fontSize: 64, fontWeight: 700 }}>CoffeeUG</div>
        <div style={{ fontSize: 26, letterSpacing: 6, color: "#9A9EB2" }}>
          GROW · EXPORT · PROSPER
        </div>
        <div style={{ fontSize: 24, color: "#FFA163" }}>
          Real coffee, real income · 10% daily for 30 days
        </div>
      </div>
    ),
    { ...size },
  );
}
