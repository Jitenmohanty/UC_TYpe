"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Building2, Check, KeyRound, LogOut, Plus, Route, ShieldCheck } from "lucide-react";
import { api, clearSession, login, logout, restoreSession, type ApiUser } from "@/lib/api";
import { RoutewiseConsole } from "@/components/routewise-console";

type Tenant = {
  id: string; name: string; slug: string; planKey: string; currency: string; suspendedAt: string | null;
  userCount: number; modules: { key: string; name: string; enabled: boolean }[];
};
type Module = { id: string; key: string; name: string };
const defaultModules = ["bookings", "fleet", "accounts", "customers", "reports"];

export function AppShell() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [platformLogin, setPlatformLogin] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSession().then((restored) => { if (active) setUser(restored); })
      .catch(() => { clearSession(); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setWorking(true); setError("");
    const values = new FormData(event.currentTarget);
    try {
      const signedIn = await login({ email: String(values.get("email")), password: String(values.get("password")), tenantSlug: platformLogin ? undefined : String(values.get("tenantSlug")), platform: platformLogin });
      setUser(signedIn);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in."); }
    finally { setWorking(false); }
  };

  const handleLogout = async () => { await logout(); setUser(null); };

  if (!ready) return <div className="auth-loading" role="status">Opening your Routewise workspace…</div>;
  if (!user) return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="brand-mark"><Route size={20} /></span><span>routewise<span className="brand-period">.</span></span></div>
    <span className="eyebrow">{platformLogin ? "PLATFORM ACCESS" : "TRAVEL OPERATIONS"}</span>
    <h1>{platformLogin ? "Sign in as owner" : "Welcome back"}</h1>
    <p className="auth-intro">{platformLogin ? "Manage business workspaces across Routewise." : "Sign in to your business workspace to continue."}</p>
    <form className="auth-form" onSubmit={handleLogin}>
      {!platformLogin && <label className="form-field">Workspace URL<input name="tenantSlug" autoComplete="organization" required placeholder="e.g. western-trails" /></label>}
      <label className="form-field">Email address<input name="email" type="email" autoComplete="username" required placeholder="you@business.com" /></label>
      <label className="form-field">Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert"><AlertCircle size={15} />{error}</p>}
      <button className="button button-primary auth-submit" type="submit" disabled={working}>{working ? "Signing in…" : <><KeyRound size={15} /> Sign in securely</>}</button>
    </form>
    <button className="auth-mode" onClick={() => { setPlatformLogin((current) => !current); setError(""); }}>{platformLogin ? "Business team sign in" : "Routewise platform owner sign in"}</button>
    <div className="auth-security"><ShieldCheck size={15} /> Workspace data is isolated by business account.</div>
  </section></main>;
  if (user.role === "SUPER_ADMIN") return <PlatformConsole user={user} onLogout={handleLogout} />;
  return <RoutewiseConsole user={user} onLogout={handleLogout} />;
}

function PlatformConsole({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [tenantData, moduleData] = await Promise.all([api.get<{ items: Tenant[] }>("/platform/tenants"), api.get<{ items: Module[] }>("/platform/modules")]);
      setTenants(tenantData.items); setModules(moduleData.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load workspaces."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const createTenant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    try {
      await api.post("/platform/tenants", {
        name: form.get("name"), slug: form.get("slug"), planKey: form.get("planKey"), currency: form.get("currency"),
        adminName: form.get("adminName"), adminEmail: form.get("adminEmail"), adminPassword: form.get("adminPassword"),
        modules: form.getAll("modules")
      });
      formElement.reset(); setMessage("Business workspace and first admin created."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create the workspace."); }
    finally { setSaving(false); }
  };

  const toggleTenant = async (tenant: Tenant) => {
    setError("");
    try {
      await api.patch(`/platform/tenants/${tenant.id}`, { status: tenant.suspendedAt ? "ACTIVE" : "SUSPENDED" });
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update workspace."); }
  };
  const toggleModule = async (tenant: Tenant, key: string, enabled: boolean) => {
    try { await api.put(`/platform/tenants/${tenant.id}/modules/${key}`, { enabled }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update module."); }
  };
  const savePlan = async (tenant: Tenant) => {
    const planKey = planDrafts[tenant.id]?.trim();
    if (!planKey || planKey === tenant.planKey) return;
    try { await api.patch("/platform/tenants/" + tenant.id, { planKey }); setMessage("Plan updated for " + tenant.name + "."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update plan."); }
  };

  return <main className="platform-page">
    <header className="platform-header"><div className="auth-brand"><span className="brand-mark"><Route size={20} /></span><span>routewise<span className="brand-period">.</span></span><span className="platform-badge">PLATFORM</span></div><div className="platform-user"><span>{user.name}</span><button className="button button-secondary" onClick={onLogout}><LogOut size={15} /> Sign out</button></div></header>
    <div className="platform-content"><div className="platform-heading"><div><span className="eyebrow">PLATFORM OWNER</span><h1>Business workspaces</h1><p>Onboard travel businesses, create their first admin, and manage enabled modules.</p></div><span className="platform-total"><Building2 size={16} /> {tenants.length} workspaces</span></div>
      {message && <div className="platform-notice" role="status"><Check size={16} />{message}</div>}{error && <div className="form-error" role="alert"><AlertCircle size={15} />{error}</div>}
      <div className="platform-grid">
        <section className="panel platform-list"><div className="platform-section-head"><div><span className="eyebrow">CUSTOMER ACCOUNTS</span><h2>Active workspaces</h2></div><button className="button button-secondary" onClick={() => void load()}>Refresh</button></div>
          {loading ? <div className="empty-state">Loading workspaces…</div> : tenants.length ? <div className="tenant-list">{tenants.map((tenant) => <article className="tenant-card" key={tenant.id}>
            <div className="tenant-card-head"><div><strong>{tenant.name}</strong><span>{tenant.slug} · {tenant.planKey} · {tenant.userCount} users</span></div><div className="tenant-card-actions"><span className={`tenant-state ${tenant.suspendedAt ? "tenant-suspended" : ""}`}>{tenant.suspendedAt ? "Suspended" : "Active"}</span><button className="button button-secondary button-compact" onClick={() => void toggleTenant(tenant)}>{tenant.suspendedAt ? "Reactivate" : "Suspend"}</button></div></div>
            <div className="tenant-plan-edit"><label>Plan key<input aria-label={tenant.name + " plan"} value={planDrafts[tenant.id] ?? tenant.planKey} onChange={(event) => setPlanDrafts((current) => ({ ...current, [tenant.id]: event.target.value }))} /></label><button className="button button-secondary button-compact" onClick={() => void savePlan(tenant)} disabled={!planDrafts[tenant.id] || planDrafts[tenant.id] === tenant.planKey}>Save plan</button></div>
            <div className="tenant-modules">{modules.map((module) => { const enabled = tenant.modules.find((entry) => entry.key === module.key)?.enabled ?? false; return <label key={module.key}><input type="checkbox" checked={enabled} onChange={(event) => void toggleModule(tenant, module.key, event.target.checked)} />{module.name}</label>; })}</div>
          </article>)}</div> : <div className="empty-state"><Building2 size={25} /><strong>No business workspaces yet</strong><span>Create the first workspace using the form.</span></div>}
        </section>
        <section className="panel platform-create"><div className="platform-section-head"><div><span className="eyebrow">NEW CUSTOMER</span><h2>Onboard a business</h2></div><span className="platform-create-icon"><Plus size={18} /></span></div>
          <form className="platform-form" onSubmit={createTenant}>
            <div className="form-row"><label className="form-field">Business name<input name="name" required minLength={2} placeholder="Western Trails" /></label><label className="form-field">Workspace URL<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="western-trails" /></label></div>
            <div className="form-row"><label className="form-field">Plan<input name="planKey" defaultValue="starter" required /></label><label className="form-field">Currency<select name="currency" defaultValue="INR"><option>INR</option><option>USD</option><option>EUR</option></select></label></div>
            <div className="form-row"><label className="form-field">Admin name<input name="adminName" required minLength={2} /></label><label className="form-field">Admin email<input name="adminEmail" type="email" required /></label></div>
            <label className="form-field">Temporary admin password<input name="adminPassword" type="password" minLength={10} required autoComplete="new-password" /><small>At least 10 characters with upper and lowercase letters, a number, and a symbol.</small></label>
            <fieldset className="module-choices"><legend>Modules included</legend>{modules.map((module) => <label key={module.key}><input type="checkbox" name="modules" value={module.key} defaultChecked={defaultModules.includes(module.key)} />{module.name}</label>)}</fieldset>
            <button className="button button-primary auth-submit" disabled={saving || modules.length === 0}>{saving ? "Creating workspace…" : modules.length === 0 ? "Loading modules…" : <><Plus size={15} /> Create business workspace</>}</button>
          </form>
        </section>
      </div>
    </div>
  </main>;
}
