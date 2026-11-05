import { connection } from "next/server"
import { getPublicSupabase } from "@/lib/supabase/public"

/**
 * Supabase pauses free projects after 7 days without activity.
 * Vercel Cron calls this daily (see vercel.json) to keep the database awake.
 */
export async function GET(request: Request) {
  await connection() // always run at request time, never prerender

  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const supabase = getPublicSupabase()
  if (!supabase) return Response.json({ ok: true, skipped: "supabase not configured" })

  const { error } = await supabase.from("categories").select("id").limit(1)
  if (error) return Response.json({ ok: false, error: "db unreachable" }, { status: 500 })

  return Response.json({ ok: true })
}
