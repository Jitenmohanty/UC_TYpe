import argon2 from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { loginSchema, permissionKeys, type PermissionKey } from "@routewise/shared";
import type { UserRole } from "@prisma/client";
import { prisma, withTenant } from "../../db/prisma.js";
import { createAccessToken, requireAuth, requireTenantUser } from "../../http/auth.js";

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false });
const cookieName = "routewise_refresh";
const csrfCookieName = "routewise_csrf";
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const strongPassword = z.string().min(10).max(200).regex(/[a-z]/, "Use a lowercase letter.").regex(/[A-Z]/, "Use an uppercase letter.").regex(/[0-9]/, "Use a number.").regex(/[^A-Za-z0-9]/, "Use a symbol.");
const loginInclude = { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } } as const;

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function newRefreshToken(scope: string | null) { return `${scope ?? "platform"}.${randomBytes(48).toString("base64url")}`; }
function cookieHeader(name: string, value: string, options: { httpOnly?: boolean; maxAge?: number; path?: string } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/api/auth"}`, "SameSite=Strict"];
  if (options.httpOnly) parts.push("HttpOnly");
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}
function cookieValue(req: Request, name: string) {
  const cookie = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}
function setSessionCookies(res: Response, refreshToken: string) {
  const csrf = randomBytes(24).toString("base64url");
  res.append("Set-Cookie", cookieHeader(cookieName, refreshToken, { httpOnly: true, maxAge: Math.floor(refreshLifetimeMs / 1000) }));
  res.append("Set-Cookie", cookieHeader(csrfCookieName, csrf, { maxAge: Math.floor(refreshLifetimeMs / 1000), path: "/" }));
  return csrf;
}
function validCsrf(req: Request) {
  const cookie = cookieValue(req, csrfCookieName);
  const header = req.header("x-csrf-token");
  return Boolean(cookie && header && cookie === header);
}

type Identity = { id: string; tenantId: string | null; role: UserRole; permissions: PermissionKey[] };
const validPermissionKeys = new Set<string>(permissionKeys);
function identityFrom(user: { id: string; tenantId: string | null; roleKey: UserRole; role: { permissions: { permission: { key: string } }[] } | null }): Identity {
  return {
    id: user.id, tenantId: user.tenantId, role: user.roleKey,
    permissions: user.roleKey === "SUPER_ADMIN" ? [] : user.role?.permissions.map(({ permission }) => permission.key).filter((key): key is PermissionKey => validPermissionKeys.has(key)) ?? []
  };
}
async function issueRefresh(identity: Identity, tenantSlug: string | null, familyId = randomUUID()) {
  const refreshToken = newRefreshToken(tenantSlug);
  const data = { tenantId: identity.tenantId, userId: identity.id, tokenHash: tokenHash(refreshToken), familyId, expiresAt: new Date(Date.now() + refreshLifetimeMs) };
  if (identity.tenantId) await withTenant(identity.tenantId, (tx) => tx.refreshToken.create({ data: { ...data, tenantId: identity.tenantId! } }));
  else await prisma.refreshToken.create({ data });
  return { refreshToken, accessToken: createAccessToken({ userId: identity.id, tenantId: identity.tenantId, role: identity.role, permissions: identity.permissions }) };
}

authRouter.post("/login", authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    if (!input.tenantSlug) return res.status(400).json({ error: "Select your business workspace to sign in." });
    const tenant = await prisma.tenant.findFirst({ where: { slug: input.tenantSlug, deletedAt: null } });
    if (!tenant || tenant.suspendedAt) {
      await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const user = await withTenant(tenant.id, (tx) => tx.user.findFirst({ where: { email: input.email.toLowerCase(), deletedAt: null, roleKey: { not: "SUPER_ADMIN" } }, include: loginInclude }));
    if (!user || user.lockedUntil && user.lockedUntil > new Date()) {
      if (!user) await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    if (!await argon2.verify(user.passwordHash, input.password)) {
      await withTenant(tenant.id, async (tx) => {
        const failed = await tx.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } });
        if (failed.failedLoginCount >= 5) await tx.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + 15 * 60_000) } });
      });
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    await withTenant(tenant.id, (tx) => tx.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }));
    const identity = identityFrom(user);
    const enabledModules = await withTenant(tenant.id, (tx) => tx.tenantModule.findMany({ where: { enabled: true }, select: { module: { select: { key: true } } } }));
    const session = await issueRefresh(identity, tenant.slug);
    const csrfToken = setSessionCookies(res, session.refreshToken);
    res.json({ accessToken: session.accessToken, csrfToken, user: { id: user.id, name: user.name, email: user.email, role: user.roleKey, permissions: identity.permissions, modules: enabledModules.map(({ module }) => module.key), tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } } });
  } catch (error) { next(error); }
});

authRouter.post("/platform-login", authLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.omit({ tenantSlug: true }).parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: input.email.toLowerCase(), tenantId: null, roleKey: "SUPER_ADMIN", deletedAt: null }, include: loginInclude });
    if (!user || user.lockedUntil && user.lockedUntil > new Date() || !await argon2.verify(user?.passwordHash ?? await argon2.hash(input.password), input.password)) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    const session = await issueRefresh(identityFrom(user), null);
    const csrfToken = setSessionCookies(res, session.refreshToken);
    res.json({ accessToken: session.accessToken, csrfToken, user: { id: user.id, name: user.name, email: user.email, role: "SUPER_ADMIN", permissions: [], modules: [] } });
  } catch (error) { next(error); }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    if (!validCsrf(req)) return res.status(403).json({ error: "CSRF token is invalid." });
    const refreshToken = cookieValue(req, cookieName);
    const scope = refreshToken?.split(".", 1)[0];
    if (!refreshToken || !scope) return res.status(401).json({ error: "Session expired. Sign in again." });
    const hash = tokenHash(refreshToken);
    const sessionResult = scope === "platform" ? await prisma.$transaction(async (tx) => {
      const saved = await tx.refreshToken.findFirst({ where: { tokenHash: hash } });
      if (!saved) return null;
      if (saved.revokedAt) {
        await tx.refreshToken.updateMany({ where: { familyId: saved.familyId }, data: { revokedAt: new Date() } });
        return { error: "reused" as const };
      }
      const user = await tx.user.findFirst({ where: { id: saved.userId, roleKey: "SUPER_ADMIN", tenantId: null, deletedAt: null }, include: loginInclude });
      if (!user || saved.expiresAt <= new Date()) return { error: "expired" as const };
      await tx.refreshToken.update({ where: { id: saved.id }, data: { revokedAt: new Date() } });
      const identity = identityFrom(user);
      const next = newRefreshToken(null);
      await tx.refreshToken.create({ data: { tenantId: null, userId: user.id, tokenHash: tokenHash(next), familyId: saved.familyId, expiresAt: new Date(Date.now() + refreshLifetimeMs) } });
      return { identity, next };
    }) : await (async () => {
      const tenant = await prisma.tenant.findFirst({ where: { slug: scope, deletedAt: null } });
      if (!tenant || tenant.suspendedAt) return null;
      return withTenant(tenant.id, async (tx) => {
        const saved = await tx.refreshToken.findFirst({ where: { tokenHash: hash } });
        if (!saved) return null;
        if (saved.revokedAt) {
          await tx.refreshToken.updateMany({ where: { familyId: saved.familyId }, data: { revokedAt: new Date() } });
          return { error: "reused" as const };
        }
        const user = await tx.user.findFirst({ where: { id: saved.userId, deletedAt: null }, include: loginInclude });
        if (!user || saved.expiresAt <= new Date()) return { error: "expired" as const };
        await tx.refreshToken.update({ where: { id: saved.id }, data: { revokedAt: new Date() } });
        const identity = identityFrom(user);
        const next = newRefreshToken(tenant.slug);
        await tx.refreshToken.create({ data: { tenantId: tenant.id, userId: user.id, tokenHash: tokenHash(next), familyId: saved.familyId, expiresAt: new Date(Date.now() + refreshLifetimeMs) } });
        return { identity, next };
      });
    })();
    if (!sessionResult) return res.status(401).json({ error: "Session expired. Sign in again." });
    if ("error" in sessionResult) return res.status(401).json({ error: "Session expired. Sign in again." });
    res.append("Set-Cookie", cookieHeader(cookieName, sessionResult.next, { httpOnly: true, maxAge: Math.floor(refreshLifetimeMs / 1000) }));
    res.json({ accessToken: createAccessToken({ userId: sessionResult.identity.id, tenantId: sessionResult.identity.tenantId, role: sessionResult.identity.role, permissions: sessionResult.identity.permissions }) });
  } catch (error) { next(error); }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    if (!validCsrf(req)) return res.status(403).json({ error: "CSRF token is invalid." });
    const token = cookieValue(req, cookieName);
    if (token) {
      const data = { revokedAt: new Date() };
      if (req.auth!.tenantId) await withTenant(req.auth!.tenantId, (tx) => tx.refreshToken.updateMany({ where: { tokenHash: tokenHash(token), userId: req.auth!.userId }, data }));
      else await prisma.refreshToken.updateMany({ where: { tokenHash: tokenHash(token), userId: req.auth!.userId }, data });
    }
    res.append("Set-Cookie", cookieHeader(cookieName, "", { httpOnly: true, maxAge: 0 }));
    res.append("Set-Cookie", cookieHeader(csrfCookieName, "", { maxAge: 0, path: "/" }));
    res.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    const data = { revokedAt: new Date() };
    if (req.auth!.tenantId) await withTenant(req.auth!.tenantId, (tx) => tx.refreshToken.updateMany({ where: { userId: req.auth!.userId, revokedAt: null }, data }));
    else await prisma.refreshToken.updateMany({ where: { userId: req.auth!.userId, revokedAt: null }, data });
    res.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post("/change-password", requireAuth, requireTenantUser, async (req, res, next) => {
  try {
    const input = z.object({ currentPassword: z.string().min(1).max(200), newPassword: strongPassword }).parse(req.body);
    const tenantId = req.auth!.tenantId;
    const outcome = await withTenant(tenantId, async (tx) => {
      const user = await tx.user.findFirst({ where: { id: req.auth!.userId, deletedAt: null } });
      if (!user || !await argon2.verify(user.passwordHash, input.currentPassword)) return false;
      const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null } });
      await tx.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return true;
    });
    if (!outcome) return res.status(400).json({ error: "Current password is incorrect." });
    res.status(204).end();
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { userId, tenantId, role, permissions } = req.auth!;
    const user = tenantId
      ? await withTenant(tenantId, (tx) => tx.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, name: true, email: true, roleKey: true, tenant: { select: { id: true, name: true, slug: true } } } }))
      : await prisma.user.findFirst({ where: { id: userId, tenantId: null, roleKey: "SUPER_ADMIN", deletedAt: null }, select: { id: true, name: true, email: true, roleKey: true } });
    if (!user) return res.status(401).json({ error: "Session expired. Sign in again." });
    const enabledModules = tenantId ? await withTenant(tenantId, (tx) => tx.tenantModule.findMany({ where: { enabled: true }, select: { module: { select: { key: true } } } })) : [];
    res.json({ id: user.id, name: user.name, email: user.email, role: role ?? user.roleKey, permissions, modules: enabledModules.map(({ module }) => module.key), ...(tenantId ? { tenant: (user as { tenant?: { id: string; name: string; slug: string } | null }).tenant } : {}) });
  } catch (error) { next(error); }
});
