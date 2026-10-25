import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Static regression checks only. Never connects to PostgreSQL or executes SQL.
// Real JWT, trigger and concurrent-revocation behavior still needs integration tests.
const sql = readFileSync(new URL("../scripts/supabase-garage.sql", import.meta.url), "utf8")
  .replace(/--[^\r\n]*/g, "");
const policies = Array.from(sql.matchAll(/create policy\s+(\w+)\s+on public\.(\w+)\s+for\s+(\w+)\b([^;]*);/gi),
  ([, name, table, command, body]) => ({ name, table, command: command.toLowerCase(), body }));

function policy(name) {
  const matches = policies.filter((entry) => entry.name === name);
  assert.equal(matches.length, 1, `Expected one policy named ${name}`);
  return matches[0].body;
}

function requireApprovedOwner(expression) {
  assert.match(expression, /owner_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(expression, /\band exists\s*\(\s*select 1 from public\.garage_members\s+where user_id\s*=\s*\(select auth\.uid\(\)\)\s+and status\s*=\s*'approved'\s*\)/i);
  assert.doesNotMatch(expression, /\bor\b/i, "No alternative may bypass ownership or membership");
}

test("SQL: every member write requires ownership and a currently approved membership", () => {
  requireApprovedOwner(policy("garage_listings_insert_own"));
  const [using, check] = policy("garage_listings_update_own").split(/\bwith check\b/i);
  assert.ok(check, "UPDATE must check both old and new rows");
  requireApprovedOwner(using);
  requireApprovedOwner(check);
  requireApprovedOwner(policy("garage_listings_delete_own"));
  const writes = policies.filter(({ table, command }) => table === "garage_listings" && command !== "select");
  assert.deepEqual(writes.map(({ command }) => command).sort(), ["delete", "insert", "update"]);
});

test("SQL: membership cannot be self-approved through grants or RLS", () => {
  assert.match(sql, /revoke all on public\.garage_categories,[^;]*public\.garage_members[^;]*from anon, authenticated;/i);
  const grants = Array.from(sql.matchAll(/grant\s+([^;]+?)\s+on public\.garage_members\s+to authenticated;/gi),
    ([, permissions]) => permissions.replace(/\s+/g, " ").trim().toLowerCase());
  assert.deepEqual(grants.sort(), ["insert (user_id)", "select"]);
  assert.deepEqual(policies.filter(({ table }) => table === "garage_members")
    .map(({ command }) => command).sort(), ["insert", "select"]);
  assert.match(policy("garage_members_request_own"), /user_id\s*=\s*\(select auth\.uid\(\)\)\s+and status\s*=\s*'pending'/i);
  assert.match(sql, /create table public\.garage_members\s*\([^;]*status text not null default 'pending'/i);
});

test("SQL: missing JWT role cannot select the privileged listing-trigger branch", () => {
  const body = /create function public\.garage_listing_guard\(\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i.exec(sql)?.[1];
  assert.ok(body, "Listing trigger must exist");
  assert.equal(Array.from(body.matchAll(/auth\.role\(\)\s+is distinct from\s+'service_role'/gi)).length, 3);
  assert.doesNotMatch(body, /auth\.role\(\)\s*(?:<>|!=)/i);
  assert.doesNotMatch(body, /\b(?:current_user|current_role|session_user)\b/i,
    "SECURITY DEFINER identity must not replace the request JWT identity");
  const [insert, update] = body.split(/\belsif auth\.role\(\)/i);
  for (const branch of [insert, update]) {
    assert.ok(branch);
    assert.match(branch, /member_id\s*:=\s*auth\.uid\(\)/i);
    assert.match(branch, /member_id is null/i);
    assert.match(branch, /garage_member_not_approved/);
    assert.match(branch, /new\.status\s*:=\s*'pending'/i);
  }
  assert.doesNotMatch(body, /new\.status\s*:=\s*'approved'/i);
});

test("SQL: callers cannot approve listings or disguise an edit as a sale", () => {
  assert.match(policy("garage_listings_insert_own"), /status\s*=\s*'pending'/i);
  const updateCheck = policy("garage_listings_update_own").split(/\bwith check\b/i)[1];
  assert.match(updateCheck, /status in\s*\('pending',\s*'sold'\)/i);
  assert.doesNotMatch(updateCheck, /status\s+in\s*\([^)]*'approved'/i);
  const sale = /if new\.status = 'sold'([\s\S]*?)end if;/i.exec(sql)?.[1];
  assert.ok(sale);
  assert.match(sale, /old\.status = 'approved'/i);
  const fields = "title, description, category_slug, price, whatsapp, images".split(", ");
  for (const field of fields) {
    assert.ok(sale.includes(`new.${field}`), `Sale compares new ${field}`);
    assert.ok(sale.includes(`old.${field}`), `Sale compares old ${field}`);
  }
  assert.match(sale, /is not distinct from/i);
});
