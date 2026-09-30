import { NextResponse } from "next/server";
import { requireAdmin, jsonError } from "@/lib/admin-auth";

export async function GET() {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const { data, error: queryError } = await admin
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });
  if (queryError) return jsonError(queryError.message, 500);
  return NextResponse.json({ products: data ?? [] });
}

/** Create a plant. Daily return defaults to the platform rate on the price. */
export async function POST(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  if (!name) return jsonError("Enter a name");
  if (!Number.isFinite(price) || price <= 0) return jsonError("Enter a valid price");

  const { data: settings } = await admin
    .from("app_settings")
    .select("daily_rate_percent, term_days")
    .eq("id", 1)
    .maybeSingle();

  const days = Number(body.days ?? settings?.term_days ?? 30);
  const dailyIncome = Number(
    body.daily_income ?? Math.round((price * Number(settings?.daily_rate_percent ?? 10)) / 100),
  );

  const { data, error: insertError } = await admin
    .from("products")
    .insert({
      name,
      price,
      days,
      daily_income: dailyIncome,
      category: body.category === "bonus" ? "bonus" : "plant",
      image_url: (body.image_url as string) || null,
      sort_order: Number(body.sort_order ?? 99),
      active: body.active !== false,
    })
    .select("*")
    .single();
  if (insertError) return jsonError(insertError.message, 500);

  return NextResponse.json({ product: data });
}

/** Update a plant, optionally pushing the change onto running activations. */
export async function PATCH(request: Request) {
  const { admin, error } = await requireAdmin();
  if (error || !admin) return jsonError(error ?? "Forbidden", error === "Unauthorized" ? 401 : 403);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!body.id) return jsonError("Missing plant");

  const { data, error: rpcError } = await admin.rpc("admin_update_product", {
    _product_id: body.id,
    _name: body.name ?? null,
    _price: body.price ?? null,
    _daily_income: body.daily_income ?? null,
    _days: body.days ?? null,
    _category: body.category ?? null,
    _active: body.active ?? null,
    _apply_to_running: body.apply_to_running === true,
  });
  if (rpcError) return jsonError(rpcError.message.replace(/^.*?:\s*/, ""), 400);

  return NextResponse.json(data);
}
