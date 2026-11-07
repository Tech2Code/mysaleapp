# Database integration tests (opt-in, hit PRODUCTION)

There is no staging database, so these run against the **linked production Supabase project**. They are not part of `npm run test`.

## Run

```bash
# 1. check config and see the plan; nothing is sent
npm run test:db -- --dry

# 2. real run (PowerShell: $env:NAME = "value"; bash: export NAME=value)
CONFIRM_PROD_DB_TESTS=1 TEST_ADMIN_EMAIL=you@example.com TEST_ADMIN_PASSWORD=... npm run test:db
CONFIRM_PROD_DB_TESTS=1 ... npm run test:db -- --only=money,access
```

- URL and anon key come from `.env`. The admin login comes **only** from the environment; never write it into a file.
- Without `CONFIRM_PROD_DB_TESTS=1` the runner refuses and exits 2.
- Exit code 0 = all pass, 1 = a check failed (or cleanup found leftovers), 2 = refused / bad config.

## Safety

- All data is marked `AUDIT TEST` (customer name, `AUDIT TEST ...` products, addresses). Real products are never modified; stock is only adjusted on test products.
- Real products' stock is snapshotted first and compared after. Cleanup runs in `finally`, then asserts no leftover rows, no stock drift, and the same product count.
- Never calls `admin_reset_data`. Anon permission checks only call RPCs that must be denied.
- Known residue: guest lock rows in `order_lookup_failures` and `rate_limits` rows have no delete path; they age out on their own.
- Don't run it while real customers are ordering (the dashboard check reads all orders; the lockout test is limited to its own order code).

## Suites (`suites/`)

| Suite | Covers |
|---|---|
| `orders` | `create_order` tampering and junk lines, merging, fee once per product, delivery rule; stock reserved and restocked once; cancel rules |
| `guest` | `track_order` privacy (masked UTR, no address), wrong-attempt lockout, `check_rate_limit` scopes and table lockdown |
| `money` | `refund_order`, `record_order_return`, return requests, `dashboard_stats` vs a raw recomputation |
| `access` | `set_default_address`, anon permission sweep on tables and RPCs |

`orders` always runs first (the others use its test products). A rule that exists in SQL and TypeScript (pricing, return window) is checked here against the real SQL; the unit tests cover the TypeScript side.
