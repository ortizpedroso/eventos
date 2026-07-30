import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { PLATFORM_SETTINGS_TAG } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_COOKIE = "eventosbr_admin_key";
const AUTH_COOKIE = "eventosbr_session";

/** Invalida cache do branding após salvar no painel admin. */
export async function POST() {
  const jar = await cookies();
  const adminKey = jar.get(ADMIN_COOKIE)?.value?.trim();
  const session = jar.get(AUTH_COOKIE)?.value?.trim();
  if (!adminKey && !session) {
    return NextResponse.json({ detail: "Sessão admin não iniciada." }, { status: 401 });
  }

  revalidateTag(PLATFORM_SETTINGS_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/contato");
  return NextResponse.json({ ok: true });
}
