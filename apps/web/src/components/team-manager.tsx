"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, KeyRound, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";

type Permission = string;
type Role = { id: string; key: string; name: string; isSystem: boolean; permissions: Permission[]; userCount: number };
type Employee = { id: string; name: string; email: string; createdAt: string; role: { id: string; key: string; name: string; permissions?: Permission[] } | null };
const permissionGroups: [string, string[]][] = [
  ["Bookings", ["booking.view", "booking.create", "booking.update", "booking.delete"]],
  ["Customers", ["customer.view", "customer.create", "customer.update", "customer.delete"]],
  ["Vehicles", ["vehicle.view", "vehicle.create", "vehicle.update", "vehicle.delete"]],
  ["Drivers", ["driver.view", "driver.create", "driver.update", "driver.delete"]],
  ["Vendors", ["vendor.view", "vendor.create", "vendor.update", "vendor.delete"]],
  ["Payments", ["payment.view", "payment.create", "payment.update", "payment.delete"]],
  ["Expenses", ["expense.view", "expense.create", "expense.update", "expense.delete"]],
  ["Commissions", ["commission.view", "commission.create", "commission.update", "commission.delete"]],
  ["Invoices", ["invoice.view", "invoice.create", "invoice.update", "invoice.delete"]],
  ["Receipts", ["receipt.view", "receipt.create", "receipt.update", "receipt.delete"]],
  ["Workspace", ["dashboard.view", "report.view", "report.export", "employee.manage", "role.manage", "tenant.settings", "audit.view"]]
];
const titlePermission = (permission: string) => permission.split(".").map((part) => part[0].toUpperCase() + part.slice(1)).join(" · ");

export function TeamManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["dashboard.view", "booking.view"]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [employeeData, roleData, permissionData] = await Promise.all([
        api.get<{ items: Employee[] }>("/team/employees"), api.get<{ items: Role[] }>("/team/roles"), api.get<{ items: string[] }>("/team/permissions")
      ]);
      setEmployees(employeeData.items); setRoles(roleData.items); setPermissions(permissionData.items);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load team settings."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const employeeRoles = useMemo(() => roles.filter((role) => !role.isSystem), [roles]);
  const createEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const values = new FormData(event.currentTarget);
    try {
      await api.post("/team/employees", { name: values.get("name"), email: values.get("email"), password: values.get("password"), roleId: values.get("roleId") });
      event.currentTarget.reset(); setEmployeeOpen(false); setNotice("Employee added to this workspace."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add employee."); }
    finally { setBusy(false); }
  };

  const updateRole = async (employee: Employee, roleId: string) => {
    try { await api.patch(`/team/employees/${employee.id}`, { roleId }); setNotice(`Access role updated for ${employee.name}.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update access."); }
  };

  const removeEmployee = async (employee: Employee) => {
    if (!window.confirm(`Remove ${employee.name} from this workspace? Their active sessions will be revoked.`)) return;
    try { await api.delete(`/team/employees/${employee.id}`); setNotice(`${employee.name} was removed.`); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove employee."); }
  };

  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const values = new FormData(formElement);
    const name = String(values.get("name") ?? "").trim();
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      if (editingRole) await api.put("/team/roles/" + editingRole.id, { key, name, permissions: selectedPermissions });
      else await api.post("/team/roles", { key, name, permissions: selectedPermissions });
      formElement.reset(); setSelectedPermissions(["dashboard.view", "booking.view"]); setRoleOpen(false); setNotice(editingRole ? `Role “${name}” updated.` : `Role “${name}” created.`); setEditingRole(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create role."); }
    finally { setBusy(false); }
  };

  const togglePermission = (permission: string) => setSelectedPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);

  return <>
    <div className="page-heading"><div><span className="eyebrow">ACCESS & PEOPLE</span><h1>Team and roles</h1><p>Invite employees and give each role only the workspace actions it needs.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={() => setRoleOpen((value) => !value)}><ShieldCheck size={15} /> New role</button><button className="button button-primary" onClick={() => setEmployeeOpen((value) => !value)}><UserPlus size={15} /> Add employee</button></div></div>
    {notice && <div className="team-notice" role="status"><Check size={15} />{notice}</div>}{error && <div className="form-error team-error" role="alert"><AlertCircle size={15} />{error}</div>}
    {roleOpen && <section className="panel role-editor"><div className="platform-section-head"><div><span className="eyebrow">CUSTOM ACCESS PROFILE</span><h2>{editingRole ? "Edit role access" : "Create a role"}</h2></div><button className="icon-button" aria-label="Close role form" onClick={() => { setRoleOpen(false); setEditingRole(null); }}>×</button></div><form key={editingRole?.id ?? "new-role"} onSubmit={createRole}>
      <label className="form-field">Role name<input name="name" required minLength={2} maxLength={100} placeholder="Bookings coordinator" defaultValue={editingRole?.name} /></label>
      <p className="permission-caption">Choose the actions employees in this role may use. The tenant admin keeps full access.</p>
      <div className="permission-grid">{permissionGroups.map(([group, entries]) => <fieldset key={group}><legend>{group}</legend>{entries.filter((entry) => permissions.includes(entry)).map((permission) => <label key={permission}><input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => togglePermission(permission)} />{titlePermission(permission)}</label>)}</fieldset>)}</div>
      <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => { setRoleOpen(false); setEditingRole(null); }}>Cancel</button><button className="button button-primary" disabled={busy}><Plus size={15} /> {editingRole ? "Save role" : "Create role"}</button></div>
    </form></section>}
    {employeeOpen && <section className="panel employee-form-panel"><div className="platform-section-head"><div><span className="eyebrow">WORKSPACE MEMBER</span><h2>Add an employee</h2></div><button className="icon-button" aria-label="Close employee form" onClick={() => setEmployeeOpen(false)}>×</button></div><form className="platform-form employee-form" onSubmit={createEmployee}>
      <div className="form-row"><label className="form-field">Full name<input name="name" required minLength={2} /></label><label className="form-field">Work email<input name="email" type="email" required /></label></div>
      <div className="form-row"><label className="form-field">Initial password<input name="password" type="password" autoComplete="new-password" minLength={10} required /><small>Use 10+ characters with uppercase, lowercase, a number, and a symbol.</small></label><label className="form-field">Access role<select name="roleId" required defaultValue=""><option value="" disabled>Select role</option>{employeeRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div>
      {!employeeRoles.length && <p className="permission-caption">Create an employee role first, then add team members.</p>}
      <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setEmployeeOpen(false)}>Cancel</button><button className="button button-primary" disabled={busy || !employeeRoles.length}><UserPlus size={15} /> Add employee</button></div>
    </form></section>}
    <div className="team-summary-grid"><article className="panel team-summary"><span>EMPLOYEES</span><strong>{employees.length}</strong><small>Active in this workspace</small></article><article className="panel team-summary"><span>ACCESS ROLES</span><strong>{employeeRoles.length}</strong><small>Custom employee profiles</small></article><article className="panel team-summary"><span>PERMISSIONS</span><strong>{permissions.length}</strong><small>Actions available to assign</small></article></div>
    <section className="panel team-table-panel"><div className="platform-section-head"><div><span className="eyebrow">TEAM MEMBERS</span><h2>Employee access</h2></div><button className="button button-secondary" onClick={() => void load()}>Refresh</button></div>
      {loading ? <div className="empty-state">Loading employee access…</div> : employees.length ? <div className="table-scroll"><table className="data-table team-table"><thead><tr><th scope="col">Employee</th><th scope="col">Email</th><th scope="col">Assigned role</th><th scope="col">Role actions</th><th scope="col"><span className="sr-only">Remove</span></th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><strong>{employee.name}</strong></td><td>{employee.email}</td><td>{employee.role?.name ?? "No role"}</td><td><select aria-label={`Change role for ${employee.name}`} value={employee.role?.id ?? ""} onChange={(event) => void updateRole(employee, event.target.value)}><option value="" disabled>Choose role</option>{employeeRoles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></td><td><button className="icon-button team-remove" aria-label={`Remove ${employee.name}`} onClick={() => void removeEmployee(employee)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><UserPlus size={24} /><strong>No employees have been added</strong><span>Create an employee role and invite your first team member.</span></div>}
    </section>
    <section className="panel roles-list-panel"><div className="platform-section-head"><div><span className="eyebrow">ROLE LIBRARY</span><h2>Available roles</h2></div></div><div className="role-list">{roles.map((role) => <article key={role.id}><span className="role-avatar"><ShieldCheck size={15} /></span><div><strong>{role.name}{role.isSystem && <em>System</em>}</strong><small>{role.isSystem ? "Full workspace administration" : `${role.permissions.length} assigned permissions`} · {role.userCount} employees</small></div><details><summary>View access</summary><div className="role-permission-tags">{role.permissions.map((permission) => <span key={permission}>{titlePermission(permission)}</span>)}</div></details>{!role.isSystem && <button className="button button-secondary button-compact" onClick={() => { setEditingRole(role); setSelectedPermissions(role.permissions); setRoleOpen(true); window.setTimeout(() => document.querySelector<HTMLInputElement>(".role-editor input[name='name']")?.focus(), 0); }}>Edit</button>}</article>)}</div></section>
    <div className="module-footnote"><KeyRound size={14} /><span>Employees can only access modules enabled by the platform owner, and their role must allow the requested action.</span></div>
  </>;
}
