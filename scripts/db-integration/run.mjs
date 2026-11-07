#!/usr/bin/env node
// Opt-in SQL/RPC integration tests against the LINKED PRODUCTION database. See README.md.
//   CONFIRM_PROD_DB_TESTS=1 TEST_ADMIN_EMAIL=... TEST_ADMIN_PASSWORD=... npm run test:db
//   npm run test:db -- --dry          (validates config and prints the plan; no network, no login)
//   npm run test:db -- --only=money   (comma separated suite names)
import { MARK, NO_ID, createContext, loadEnv, msg } from "./lib.mjs"

const SUITES = ["orders", "guest", "money", "access"] // order matters: orders creates the products the others use
const args = process.argv.slice(2)
const dry = args.includes("--dry")
const onlyArg = args.find((a) => a.startsWith("--only="))
const only = onlyArg ? onlyArg.slice(7).split(",").filter(Boolean) : null
if (only) {
  const unknown = only.filter((s) => !SUITES.includes(s))
  if (unknown.length) {
    console.error(`Unknown suite(s): ${unknown.join(", ")}. Available: ${SUITES.join(", ")}`)
    process.exit(2)
  }
}
// later suites need the products created by "orders"
const selected = SUITES.filter((s) => !only || only.includes(s) || s === "orders")

const env = loadEnv()
const host = (() => {
  try {
    return new URL(env.NEXT_PUBLIC_SUPABASE_URL).host
  } catch {
    return null
  }
})()

const banner = `
##########################################################################
#  WARNING: these tests run against the LINKED PRODUCTION Supabase DB.   #
#  They create rows marked "${MARK}", then delete them. They never call   #
#  admin_reset_data. Do not run while real orders are being placed.      #
##########################################################################`
console.log(banner)

// ---- config validation (also what --dry reports) ----
const problems = []
if (!host) problems.push("NEXT_PUBLIC_SUPABASE_URL missing or invalid (.env)")
if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) problems.push("NEXT_PUBLIC_SUPABASE_ANON_KEY missing (.env)")
if (!env.TEST_ADMIN_EMAIL) problems.push("TEST_ADMIN_EMAIL not set (environment variable only)")
if (!env.TEST_ADMIN_PASSWORD) problems.push("TEST_ADMIN_PASSWORD not set (environment variable only)")

if (dry) {
  console.log(`\n--dry: configuration check only. Nothing is sent to the database.\n`)
  console.log(`  target host        : ${host ?? "(none)"}`)
  console.log(`  anon key           : ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "MISSING"}`)
  console.log(`  TEST_ADMIN_EMAIL   : ${env.TEST_ADMIN_EMAIL ? "set" : "MISSING"}`)
  console.log(`  TEST_ADMIN_PASSWORD: ${env.TEST_ADMIN_PASSWORD ? "set" : "MISSING"}`)
  console.log(`  CONFIRM_PROD_DB_TESTS=1: ${env.CONFIRM_PROD_DB_TESTS === "1" ? "yes" : "no (required for a real run)"}`)
  console.log(`\nPlan (suites run in this order):`)
  for (const name of selected) {
    const { description } = await import(`./suites/${name}.mjs`)
    console.log(`  - ${name}: ${description}`)
  }
  console.log(`\nSetup  : sign in as the admin, snapshot every non-test product's stock, read store_settings`)
  console.log(`Cleanup: (always, in finally) delete rows marked "${MARK}" (orders, returns, requests, products, addresses),`)
  console.log(`         restore address defaults, then assert: no leftovers, real stock unchanged, same product count`)
  console.log(problems.length ? `\nConfig problems:\n  - ${problems.join("\n  - ")}` : "\nConfig looks complete.")
  process.exit(problems.length ? 2 : 0)
}

if (env.CONFIRM_PROD_DB_TESTS !== "1") {
  console.error("\nRefusing to run: set CONFIRM_PROD_DB_TESTS=1 to confirm you want to hit the production database.")
  console.error("Use `npm run test:db -- --dry` to check the configuration and see the plan without touching anything.")
  process.exit(2)
}
if (problems.length) {
  console.error(`\nConfig problems:\n  - ${problems.join("\n  - ")}`)
  process.exit(2)
}

console.log(`\nTarget: ${host}  (starting in 5 seconds, Ctrl+C to abort)`)
await new Promise((r) => setTimeout(r, 5000))

const ctx = createContext(env)
let fatal = false
let leftoverFailures = 0

async function setup() {
  const s = await ctx.admin.auth.signInWithPassword({ email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD })
  if (s.error) throw new Error("admin login failed: " + s.error.message)
  ctx.adminUid = s.data.user.id
  const adm = await ctx.admin.rpc("is_admin")
  if (adm.error || adm.data !== true) throw new Error("TEST_ADMIN_EMAIL is not an admin of this shop")
  const products = (await ctx.admin.from("products").select("id,stock,name")).data ?? []
  ctx.realSnap = products.filter((p) => !p.name.startsWith(MARK)).map((p) => ({ id: p.id, stock: p.stock }))
  const stale = products.filter((p) => p.name.startsWith(MARK)).length
  if (stale) throw new Error(`${stale} leftover "${MARK}" products from an earlier run exist; inspect and delete them first`)
  ctx.settings = (await ctx.admin.from("store_settings").select("*").limit(1).single()).data
  ctx.info("real products snapshotted", ctx.realSnap.length)
}

async function cleanup() {
  console.log("---- CLEANUP ----")
  const { admin, created } = ctx
  try {
    for (const id of created.addresses) await admin.from("addresses").delete().eq("id", id)
    for (const a of ctx.addrSnap) await admin.from("addresses").update({ is_default: a.is_default }).eq("id", a.id)
    await admin.from("addresses").delete().eq("full_name", MARK).eq("user_id", ctx.adminUid)
    const ids = (await admin.from("orders").select("id").eq("customer_name", MARK)).data?.map((o) => o.id) ?? []
    for (const id of ids) {
      await admin.from("return_requests").delete().eq("order_id", id)
      await admin.from("order_returns").delete().eq("order_id", id)
    }
    const del = await admin.from("orders").delete().eq("customer_name", MARK).select("id")
    ctx.info("orders deleted", { n: del.data?.length, err: msg(del) })
    const dp = await admin.from("products").delete().like("name", `${MARK} %`).select("id")
    ctx.info("products deleted", { n: dp.data?.length, err: msg(dp) })
  } catch (e) {
    console.log("cleanup error:", e.message)
  }

  const none = (list) => (list.length ? list : [NO_ID])
  const count = async (q) => (await q).count ?? "n/a"
  const left = {
    orders: await ctx.countMarker(),
    products: await count(admin.from("products").select("id", { count: "exact", head: true }).like("name", `${MARK}%`)),
    addresses: await count(admin.from("addresses").select("id", { count: "exact", head: true }).eq("full_name", MARK)),
    returnRequests: (await admin.from("return_requests").select("id").in("order_id", none(created.orders))).data?.length,
    orderReturns: (await admin.from("order_returns").select("id").in("order_id", none(created.orders))).data?.length,
    statusHistory: (await admin.from("order_status_history").select("id").in("order_id", none(created.orders))).data?.length,
  }
  const dirty = Object.entries(left).filter(([, n]) => n !== 0)
  ctx.rec("cleanup", "no leftover test rows", dirty.length === 0, left)

  const now = (await admin.from("products").select("id,stock")).data ?? []
  const byId = new Map(now.map((p) => [p.id, p.stock]))
  const diffs = ctx.realSnap.filter((p) => byId.get(p.id) !== p.stock)
  ctx.rec("cleanup", "real products' stock unchanged", diffs.length === 0, diffs)
  ctx.rec("cleanup", "no real product added or removed", now.length === ctx.realSnap.length, { before: ctx.realSnap.length, after: now.length })
  leftoverFailures = ctx.results.filter((r) => r.suite === "cleanup" && !r.pass).length
}

try {
  await setup()
  for (const name of selected) {
    console.log(`==== ${name} ====`)
    try {
      await (await import(`./suites/${name}.mjs`)).run(ctx)
    } catch (e) {
      ctx.rec(name, "suite threw", false, e.message)
      if (name === "orders") console.log("   (later suites depend on the products created here)")
    }
  }
} catch (e) {
  fatal = true
  console.error("FATAL:", e.message)
} finally {
  if (ctx.adminUid) await cleanup()
  const failed = ctx.results.filter((r) => !r.pass)
  console.log(`\nTOTAL ${ctx.results.length}, PASS ${ctx.results.length - failed.length}, FAIL ${failed.length}`)
  for (const f of failed) console.log(`  FAILED [${f.suite}] ${f.name}`)
  if (leftoverFailures) console.log("  >>> cleanup found leftovers or stock drift: inspect the database manually")
  process.exitCode = fatal || failed.length ? 1 : 0
}
