import type { Audit } from "@/types/audit";
import type { AuditJobState, Env, StoredJobRow } from "../types";
import { AppError } from "../errors";

export async function createJob(env: Env, state: AuditJobState, clientKey: string, ttlSeconds: number): Promise<void> {
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO audit_jobs (id, status, stage, state_json, audit_json, version, created_at, updated_at, expires_at, client_key)
     VALUES (?1, 'running', ?2, ?3, NULL, 0, ?4, ?4, ?5, ?6)`,
  )
    .bind(state.id, state.stage, JSON.stringify(state), now, now + ttlSeconds * 1000, clientKey)
    .run();
}

export async function getJob(env: Env, id: string): Promise<{ row: StoredJobRow; state: AuditJobState } | null> {
  const row = await env.DB.prepare(
    `SELECT id, status, stage, state_json, audit_json, version, created_at, updated_at, expires_at, client_key
     FROM audit_jobs WHERE id = ?1 AND expires_at > ?2`,
  )
    .bind(id, Date.now())
    .first<StoredJobRow>();
  if (!row) return null;
  return { row, state: JSON.parse(row.state_json) as AuditJobState };
}

export async function saveJobState(
  env: Env,
  state: AuditJobState,
  expectedVersion: number,
  ttlSeconds: number,
  status: "running" | "completed" | "partial" | "failed" = "running",
): Promise<number> {
  const nextVersion = expectedVersion + 1;
  const now = Date.now();
  const result = await env.DB.prepare(
    `UPDATE audit_jobs
     SET status = ?1, stage = ?2, state_json = ?3, audit_json = ?4, version = ?5, updated_at = ?6, expires_at = ?7
     WHERE id = ?8 AND version = ?9`,
  )
    .bind(
      status,
      state.stage,
      JSON.stringify({ ...state, version: nextVersion }),
      state.audit ? JSON.stringify(state.audit) : null,
      nextVersion,
      now,
      now + ttlSeconds * 1000,
      state.id,
      expectedVersion,
    )
    .run();

  if ((result.meta.changes ?? 0) !== 1) {
    throw new AppError({
      code: "AUDIT_CONFLICT",
      title: "Controle wordt al bijgewerkt",
      message: "Een andere aanvraag verwerkt deze controle al. Probeer de voortgang opnieuw op te halen.",
      status: 409,
      retryable: true,
    });
  }
  state.version = nextVersion;
  return nextVersion;
}

export async function getStoredAudit(env: Env, id: string): Promise<Audit | null> {
  const row = await env.DB.prepare(`SELECT audit_json FROM audit_jobs WHERE id = ?1 AND expires_at > ?2`)
    .bind(id, Date.now())
    .first<{ audit_json: string | null }>();
  return row?.audit_json ? (JSON.parse(row.audit_json) as Audit) : null;
}

export async function deleteJob(env: Env, id: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM audit_jobs WHERE id = ?1`).bind(id).run();
}

export async function consumeFixedWindow(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expiresAt = windowStart + windowSeconds;

  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, window_start, expires_at)
     VALUES (?1, 1, ?2, ?3)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start,
       expires_at = excluded.expires_at
     RETURNING count, expires_at`,
  )
    .bind(key, windowStart, expiresAt)
    .first<{ count: number; expires_at: number }>();

  const count = row?.count ?? limit + 1;
  return { allowed: count <= limit, count, resetAt: (row?.expires_at ?? expiresAt) * 1000 };
}

export async function cleanupExpired(env: Env): Promise<void> {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM audit_jobs WHERE expires_at <= ?1`).bind(nowMs),
    env.DB.prepare(`DELETE FROM rate_limits WHERE expires_at <= ?1`).bind(nowSeconds),
  ]);
}
