import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { permissionKeys, type PermissionKey } from "@routewise/shared";

export type AuthRole = "SUPER_ADMIN" | "TENANT_ADMIN" | "EMPLOYEE";
export type AuthContext = {
  userId: string;
  tenantId: string;
  role: AuthRole;
  permissions: PermissionKey[];
};

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request { auth?: AuthContext }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

const permissionKeySet = new Set<string>(permissionKeys);

export function createAccessToken(input: Omit<AuthContext, "tenantId"> & { tenantId: string | null }) {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_ACCESS_SECRET must be at least 32 characters.");
  return jwt.sign({ tenantId: input.tenantId, role: input.role, permissions: input.permissions }, secret, {
    algorithm: "HS256", subject: input.userId, expiresIn: "15m", issuer: "routewise-api", audience: "routewise-web"
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!token || !secret || secret.length < 32) return res.status(401).json({ error: "Authentication required." });
  try {
    const claims = jwt.verify(token, secret, { algorithms: ["HS256"], issuer: "routewise-api", audience: "routewise-web" }) as jwt.JwtPayload;
    const allowedRole = claims.role === "SUPER_ADMIN" || claims.role === "TENANT_ADMIN" || claims.role === "EMPLOYEE";
    const tenantId = claims.tenantId === null && claims.role === "SUPER_ADMIN" ? "" : claims.tenantId;
    if (typeof claims.sub !== "string" || !allowedRole || typeof tenantId !== "string" || !Array.isArray(claims.permissions)) {
      return res.status(401).json({ error: "Authentication required." });
    }
    req.auth = {
      userId: claims.sub,
      tenantId,
      role: claims.role,
      permissions: claims.permissions.filter((key): key is PermissionKey => typeof key === "string" && permissionKeySet.has(key))
    };
    next();
  } catch {
    res.status(401).json({ error: "Authentication required." });
  }
}

export function requireRole(...roles: AuthRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth && roles.includes(req.auth.role)) return next();
    return res.status(403).json({ error: "You do not have access to this action." });
  };
}

export function requireTenantUser(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || req.auth.role === "SUPER_ADMIN" || !req.auth.tenantId) return res.status(403).json({ error: "A tenant user session is required." });
  void import("../db/prisma.js").then(({ prisma }) => prisma.tenant.findFirst({ where: { id: req.auth!.tenantId, deletedAt: null }, select: { suspendedAt: true } })).then((tenant) => {
    if (!tenant || tenant.suspendedAt) {
      res.status(403).json({ error: "This workspace is unavailable." });
      return null;
    }
    return import("../db/prisma.js").then(({ withTenant }) => withTenant(req.auth!.tenantId, (tx) => tx.user.findFirst({
      where: { id: req.auth!.userId, deletedAt: null, roleKey: { not: "SUPER_ADMIN" } },
      select: {
        roleKey: true,
        role: { select: { permissions: { select: { permission: { select: { key: true } } } } } }
      }
    })));
  }).then((user) => {
    if (!user || user.roleKey === "SUPER_ADMIN") {
      res.status(401).json({ error: "Your account is unavailable. Sign in again." });
      return;
    }
    req.auth!.role = user.roleKey;
    req.auth!.permissions = user.roleKey === "TENANT_ADMIN" ? [...permissionKeys] : user.role?.permissions.map(({ permission }) => permission.key).filter((key): key is PermissionKey => permissionKeySet.has(key)) ?? [];
    next();
  }).catch(next);
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.role === "TENANT_ADMIN" || req.auth?.permissions.includes(permission)) return next();
    return res.status(403).json({ error: "You do not have access to this action." });
  };
}

export function requireModule(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth?.tenantId || req.auth.role === "SUPER_ADMIN") return res.status(403).json({ error: "A tenant user session is required." });
    try {
      const { withTenant } = await import("../db/prisma.js");
      const enabled = await withTenant(req.auth.tenantId, (tx) => tx.tenantModule.findFirst({
        where: { module: { key: moduleKey }, enabled: true }, select: { moduleId: true }
      }));
      if (!enabled) return res.status(403).json({ error: "This module is not enabled for your workspace." });
      next();
    } catch (error) { next(error); }
  };
}
