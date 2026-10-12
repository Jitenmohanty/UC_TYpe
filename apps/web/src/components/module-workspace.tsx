"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Download, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, type ApiUser } from "@/lib/api";

type View = "Fleet" | "Drivers" | "Customers" | "Vendors" | "Accounts" | "Reports";
type Row = { id: string; cells: string[]; raw: Raw };
type Field = { name: string; label: string; type?: string; required?: boolean; options?: { id: string; label: string }[] };
type Resource = { title: string; description: string; endpoint: string; columns: string[]; rows: Row[]; fields: Field[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean };
type Raw = Record<string, unknown>;

const str = (value: unknown, fallback = "—") => value === null || value === undefined || value === "" ? fallback : String(value);
const obj = (value: unknown): Raw => value && typeof value === "object" ? value as Raw : {};
const arr = (value: unknown): Raw[] => Array.isArray(value) ? value.map(obj) : [];
const dateLabel = (value: unknown) => value ? new Date(String(value)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const moneyLabel = (value: unknown) => value === null || value === undefined ? "₹0" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
const allowed = (user: ApiUser, key: string) => user.role === "TENANT_ADMIN" || user.permissions.includes(key);

const tabsFor = (view: View, user: ApiUser) => {
  if (view === "Accounts") return ["Payments", "Expenses", "Commissions", "Invoices", "Receipts"].filter((name) => allowed(user, name.slice(0, -1).toLowerCase() + ".view"));
  if (view === "Reports") return ["Bookings", "Payments", "Outstanding", "Vendor dues", "Net revenue"];
  return [view];
};
const pathFor = (view: View, tab: string) => {
  if (view === "Fleet") return "/vehicles";
  if (view === "Drivers") return "/drivers";
  if (view === "Customers") return "/customers";
  if (view === "Vendors") return "/vendors";
  if (view === "Accounts") return "/accounts/" + tab.toLowerCase();
  if (tab === "Net revenue") return "/reports/net-revenue";
  return "/reports/" + tab.toLowerCase().replaceAll(" ", "-");
};

function makeResource(view: View, tab: string, user: ApiUser, payload: unknown, bookings: Field["options"] = [], vendors: Field["options"] = [], invoices: Field["options"] = []): Resource {
  const items = arr(obj(payload).items);
  const base = { title: tab, description: "Workspace records from the tenant API.", endpoint: pathFor(view, tab), columns: [] as string[], rows: [] as Row[], fields: [] as Field[], canCreate: false, canUpdate: false, canDelete: false };
  if (view === "Fleet") return { ...base, title: "Vehicles", description: "Vehicle registration, type, capacity, documents and next assignment.", columns: ["Vehicle", "Type", "Capacity", "Next booking", "Driver", "Insurance", "Permit"], canCreate: allowed(user, "vehicle.create"), canUpdate: allowed(user, "vehicle.update"), canDelete: allowed(user, "vehicle.delete"), fields: [{ name: "registrationNo", label: "Registration number", required: true }, { name: "type", label: "Vehicle type", required: true }, { name: "capacity", label: "Capacity", type: "number", required: true }, { name: "insuranceExpires", label: "Insurance expiry", type: "date" }, { name: "permitExpires", label: "Permit expiry", type: "date" }], rows: items.map((item) => { const assignment = arr(item.assignments)[0] ?? {}; return { id: str(item.id), raw: item, cells: [str(item.registrationNo), str(item.type), str(item.capacity), str(obj(assignment.booking).serialNo), str(obj(assignment.driver).name), dateLabel(item.insuranceExpires), dateLabel(item.permitExpires)] }; }) };
  if (view === "Drivers") return { ...base, description: "Driver contacts, licence information and upcoming assignments.", columns: ["Driver", "Contact", "Licence", "Licence expiry", "Next booking", "Vehicle"], canCreate: allowed(user, "driver.create"), canUpdate: allowed(user, "driver.update"), canDelete: allowed(user, "driver.delete"), fields: [{ name: "name", label: "Driver name", required: true }, { name: "phone", label: "Contact number", required: true }, { name: "licenseNo", label: "Licence number", required: true }, { name: "licenseExpires", label: "Licence expiry", type: "date" }], rows: items.map((item) => { const assignment = arr(item.assignments)[0] ?? {}; return { id: str(item.id), raw: item, cells: [str(item.name), str(item.phone), str(item.licenseNo), dateLabel(item.licenseExpires), str(obj(assignment.booking).serialNo), str(obj(assignment.vehicle).registrationNo)] }; }) };
  if (view === "Customers") return { ...base, description: "Client contact details and their booking history.", columns: ["Customer", "Email", "Phone", "Company", "Bookings", "Notes"], canCreate: allowed(user, "customer.create"), canUpdate: allowed(user, "customer.update"), canDelete: allowed(user, "customer.delete"), fields: [{ name: "name", label: "Customer name", required: true }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone number", required: true }, { name: "company", label: "Company" }], rows: items.map((item) => ({ id: str(item.id), raw: item, cells: [str(item.name), str(item.email), str(item.phone), str(item.company), str(obj(item._count).bookings, "0"), str(item.notes)] })) };
  if (view === "Vendors") return { ...base, description: "Vendor service types and contact information.", columns: ["Vendor", "Service", "Email", "Phone", "Added"], canCreate: allowed(user, "vendor.create"), canUpdate: allowed(user, "vendor.update"), canDelete: allowed(user, "vendor.delete"), fields: [{ name: "name", label: "Vendor name", required: true }, { name: "serviceType", label: "Service type" }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone number" }], rows: items.map((item) => ({ id: str(item.id), raw: item, cells: [str(item.name), str(item.serviceType), str(item.email), str(item.phone), dateLabel(item.createdAt)] })) };
  if (view === "Accounts") {
    const columns: Record<string, string[]> = { Payments: ["Date", "Direction", "Booking / vendor", "Method", "Reference", "Amount"], Expenses: ["Date", "Category", "Description", "Vendor", "Amount"], Commissions: ["Booking", "Payee", "Created", "Amount"], Invoices: ["Invoice", "Booking", "Issued", "Due", "Total", "Status"], Receipts: ["Receipt", "Invoice", "Issued", "Amount"] };
    const rows = items.map((item): Row => {
      if (tab === "Payments") return { id: str(item.id), raw: item, cells: [dateLabel(item.paidAt), str(item.direction), str(obj(item.booking).serialNo, obj(item.vendor).name ? String(obj(item.vendor).name) : "—"), str(item.method), str(item.reference), moneyLabel(item.amount)] };
      if (tab === "Expenses") return { id: str(item.id), raw: item, cells: [dateLabel(item.incurredAt), str(item.category), str(item.description), str(obj(item.vendor).name), moneyLabel(item.amount)] };
      if (tab === "Commissions") return { id: str(item.id), raw: item, cells: [str(obj(item.booking).serialNo), str(item.payeeName), dateLabel(item.createdAt), moneyLabel(item.amount)] };
      if (tab === "Invoices") return { id: str(item.id), raw: item, cells: [str(item.number), str(obj(item.booking).serialNo), dateLabel(item.issuedAt), dateLabel(item.dueAt), moneyLabel(item.total), str(item.status)] };
      return { id: str(item.id), raw: item, cells: [str(item.number), str(obj(item.invoice).number), dateLabel(item.issuedAt), moneyLabel(item.amount)] };
    });
    const fields: Record<string, Field[]> = {
      Payments: [{ name: "direction", label: "Direction", type: "select", required: true, options: [{ id: "INBOUND", label: "Customer payment received" }, { id: "OUTBOUND", label: "Vendor payment" }] }, { name: "bookingId", label: "Booking", type: "select", options: bookings }, { name: "vendorId", label: "Vendor", type: "select", options: vendors }, { name: "amount", label: "Amount", type: "number", required: true }, { name: "method", label: "Payment method" }, { name: "reference", label: "Reference" }, { name: "paidAt", label: "Paid at", type: "datetime-local", required: true }],
      Expenses: [{ name: "category", label: "Expense category", required: true }, { name: "description", label: "Description" }, { name: "vendorId", label: "Vendor", type: "select", options: vendors }, { name: "amount", label: "Amount", type: "number", required: true }, { name: "incurredAt", label: "Incurred at", type: "datetime-local", required: true }],
      Commissions: [{ name: "bookingId", label: "Booking", type: "select", options: bookings, required: true }, { name: "payeeName", label: "Payee name" }, { name: "amount", label: "Commission", type: "number", required: true }],
      Invoices: [{ name: "bookingId", label: "Booking", type: "select", options: bookings, required: true }, { name: "total", label: "Invoice total", type: "number", required: true }, { name: "issuedAt", label: "Issue date", type: "date", required: true }, { name: "dueAt", label: "Due date", type: "date" }],
      Receipts: [{ name: "invoiceId", label: "Invoice", type: "select", options: invoices }, { name: "paymentId", label: "Payment ID" }, { name: "amount", label: "Receipt amount", type: "number", required: true }, { name: "issuedAt", label: "Issue date", type: "date", required: true }]
    };
    const prefix = tab.slice(0, -1).toLowerCase();
    return { ...base, description: "Advances, balances, payouts, expenses and supporting records.", columns: columns[tab] ?? [], rows, fields: fields[tab] ?? [], canCreate: allowed(user, prefix + ".create"), canUpdate: allowed(user, prefix + ".update"), canDelete: allowed(user, prefix + ".delete") };
  }
  if (view === "Reports") {
    const columns: Record<string, string[]> = { Bookings: ["Booking", "Client", "Destination", "Travel date", "Status", "Value"], Payments: ["Date", "Direction", "Booking / vendor", "Reference", "Amount"], Outstanding: ["Booking", "Client", "Destination", "Travel date", "Received", "Balance"], "Vendor dues": ["Vendor", "Billed", "Paid", "Due"] };
    const rows = tab === "Bookings" ? items.map((item) => ({ id: str(item.id), raw: item, cells: [str(item.serialNo), str(item.customerName), str(item.destination), dateLabel(item.startDate), str(item.status), moneyLabel(item.totalAmount)] }))
      : tab === "Payments" ? items.map((item) => ({ id: str(item.id), raw: item, cells: [dateLabel(item.paidAt), str(item.direction), str(obj(item.booking).serialNo, obj(item.vendor).name ? String(obj(item.vendor).name) : "—"), str(item.reference), moneyLabel(item.amount)] }))
        : tab === "Outstanding" ? items.map((item) => ({ id: str(item.id), raw: item, cells: [str(item.serialNo), str(item.customerName), str(item.destination), dateLabel(item.startDate), moneyLabel(item.received), moneyLabel(item.balance)] }))
          : tab === "Vendor dues" ? items.map((item) => ({ id: str(item.id), raw: item, cells: [str(item.name), moneyLabel(item.billed), moneyLabel(item.paid), moneyLabel(item.due)] })) : [];
    if (tab === "Net revenue") return { ...base, description: "Revenue, collections, vendor payouts and operating costs.", columns: ["Measure", "Amount"], rows: Object.entries(obj(payload)).filter(([key, value]) => key !== "range" && typeof value === "string").map(([key, value]) => ({ id: key, raw: {}, cells: [key.replaceAll(/([A-Z])/g, " $1"), moneyLabel(value)] })), canCreate: false };
    return { ...base, description: "Tenant-scoped " + tab.toLowerCase() + " report.", columns: columns[tab] ?? [], rows, canCreate: false };
  }
  return base;
}

function csvDownload(view: string, columns: string[], rows: Row[]) {
  const csv = [columns, ...rows.map((row) => row.cells)].map((line) => line.map((cell) => '"' + cell.replaceAll('"', '""') + '"').join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "routewise-" + view.toLowerCase() + ".csv"; link.click(); URL.revokeObjectURL(url);
}

export function ModuleWorkspace({ view, query, user }: { view: View; query: string; user: ApiUser }) {
  const tabs = useMemo(() => tabsFor(view, user), [view, user]);
  const [tab, setTab] = useState(tabs[0] ?? view);
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const load = useCallback(async () => {
    if (!tabs.length) { setLoading(false); setError("Your role does not have access to this account section."); return; }
    setLoading(true); setError("");
    try {
      const suffix = tab === "Net revenue" ? "" : "?page=1&pageSize=100" + (query ? "&search=" + encodeURIComponent(query) : "");
      const payload = await api.get<unknown>(pathFor(view, tab) + suffix);
      let bookingChoices: Field["options"] = [];
      let vendorChoices: Field["options"] = [];
      let invoiceChoices: Field["options"] = [];
      if (view === "Accounts" && ["Payments", "Commissions", "Invoices"].includes(tab) && allowed(user, "booking.view")) {
        try { const result = await api.get<{ items: Raw[] }>("/bookings?pageSize=100"); bookingChoices = result.items.map((item) => ({ id: str(item.id), label: str(item.serialNo) + " · " + str(item.customerName) })); } catch { bookingChoices = []; }
      }
      if (view === "Accounts" && ["Payments", "Expenses"].includes(tab) && allowed(user, "vendor.view")) {
        try { const result = await api.get<{ items: Raw[] }>("/vendors?pageSize=100"); vendorChoices = result.items.map((item) => ({ id: str(item.id), label: str(item.name) })); } catch { vendorChoices = []; }
      }
      if (view === "Accounts" && tab === "Receipts" && allowed(user, "invoice.view")) {
        try { const result = await api.get<{ items: Raw[] }>("/accounts/invoices?pageSize=100"); invoiceChoices = result.items.map((item) => ({ id: str(item.id), label: str(item.invoiceNo) })); } catch { invoiceChoices = []; }
      }
      setResource(makeResource(view, tab, user, payload, bookingChoices, vendorChoices, invoiceChoices));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load workspace data."); setResource(null); }
    finally { setLoading(false); }
  }, [tabs, view, tab, query, user]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!tabs.includes(tab) && tabs.length) setTab(tabs[0]); }, [tabs, tab]);
  const rows = useMemo(() => (resource?.rows ?? []).filter((row) => !query || row.cells.join(" ").toLowerCase().includes(query.toLowerCase())), [resource, query]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!resource) return;
    const values = new FormData(event.currentTarget); const body: Raw = {};
    for (const [name, value] of values.entries()) {
      if (!value) continue;
      const field = resource.fields.find((item) => item.name === name);
      body[name] = field?.type === "date" ? new Date(String(value) + "T12:00:00").toISOString() : field?.type === "datetime-local" ? new Date(String(value)).toISOString() : String(value);
    }
    if (view === "Accounts" && tab === "Payments") {
      if (body.direction === "INBOUND") delete body.vendorId;
      else delete body.bookingId;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      if (view === "Accounts" && tab === "Payments") {
        if (body.direction === "INBOUND") delete body.vendorId;
        else delete body.bookingId;
      }
      if (editing) await api.patch(resource.endpoint + "/" + editing.id, body);
      else await api.post(resource.endpoint, body);
      setAdding(false); setEditing(null); setNotice(editing ? "Record updated." : "Record added to this workspace."); await load();
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this record."); }
    finally { setBusy(false); }
  };
  const remove = async (row: Row) => {
    if (!resource || !window.confirm("Remove this record from the workspace?")) return;
    setError(""); setNotice("");
    try { await api.delete(resource.endpoint + "/" + row.id); setNotice("Record removed."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove this record."); }
  };
  const editValue = (field: Field) => {
    const value = editing?.raw[field.name];
    if (value === null || value === undefined) return "";
    if (field.type === "datetime-local") {
      const date = new Date(String(value));
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    return String(value).slice(0, field.type === "date" ? 10 : undefined);
  };
  const title = view;
  const description: Record<View, string> = { Fleet: "Vehicle registrations, capacity and trip assignments.", Drivers: "Driver details, licences and upcoming trips.", Customers: "Client details and booking relationships.", Vendors: "Partner services and vendor records.", Accounts: "Advances, balances, vendor payouts and expenses.", Reports: "Booking history, payment reports, outstanding balances and vendor dues." };
  const actionName = view === "Fleet" ? "vehicle" : view === "Drivers" ? "driver" : view === "Customers" ? "customer" : view === "Vendors" ? "vendor" : tab.toLowerCase().replace(/s$/, "");
  return <>
    <div className="page-heading"><div><span className="eyebrow">{view === "Reports" ? "BUSINESS REPORTS" : view === "Accounts" ? "MONEY IN MOTION" : view.toUpperCase()}</span><h1>{title}</h1><p>{description[view]}</p></div><div className="heading-actions">{resource && allowed(user, "report.export") && <button className="button button-secondary" onClick={() => csvDownload(view, resource.columns, rows)}><Download size={15} /> Export CSV</button>}{resource?.canCreate && resource.fields.length > 0 && <button className="button button-primary" onClick={() => setAdding((value) => !value)}><Plus size={15} /> Add {actionName}</button>}</div></div>
    {notice && <div className="team-notice" role="status"><Check size={15} />{notice}</div>}{error && <div className="form-error team-error" role="alert"><AlertCircle size={15} />{error}</div>}
    {tabs.length > 1 && <div className="module-tabs" role="tablist" aria-label={view + " sections"}>{tabs.map((name) => <button type="button" key={name} className={"filter-tab " + (name === tab ? "filter-tab-active" : "")} role="tab" aria-selected={name === tab} onClick={() => { setTab(name); setAdding(false); }}>{name}</button>)}</div>}
    {adding && resource && <form key={editing?.id ?? "new-record"} className="panel module-create-form" onSubmit={create}><div className="platform-section-head"><div><span className="eyebrow">{editing ? "UPDATE RECORD" : "NEW RECORD"}</span><h2>{editing ? "Edit " : "Add "}{actionName}</h2></div><button type="button" className="button button-secondary" onClick={() => { setAdding(false); setEditing(null); }}>Cancel</button></div><div className="module-form-grid">{resource.fields.map((field) => <label className="form-field" key={field.name}>{field.label}{field.type === "select" ? <select name={field.name} required={field.required} defaultValue={editValue(field)}><option value="">Select…</option>{(field.options ?? []).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <input name={field.name} type={field.type ?? "text"} required={field.required} step={field.type === "number" ? "0.01" : undefined} defaultValue={editing ? editValue(field) : field.type === "datetime-local" ? new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : undefined} />}</label>)}</div><div className="dialog-actions"><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Save record"}</button></div></form>}
    <section className="module-metrics" aria-label={view + " summary"}><article className="panel module-metric"><span className="module-metric-icon"><RefreshCw size={16} /></span><small>Records shown</small><strong>{rows.length}</strong><span>{loading ? "Refreshing…" : "Current workspace view"}</span></article><article className="panel module-metric"><span className="module-metric-icon module-tone-1"><Check size={16} /></span><small>Search filter</small><strong>{query ? "Active" : "None"}</strong><span>{query ? "Matching " + query : "Showing latest records"}</span></article><article className="panel module-metric"><span className="module-metric-icon module-tone-2"><RefreshCw size={16} /></span><small>Workspace scope</small><strong>Tenant</strong><span>{user.tenant?.name ?? "Your business"}</span></article></section>
    <section className="panel module-table-panel"><div className="panel-heading module-table-heading"><div><span className="eyebrow">{(resource?.title ?? tab).toUpperCase()}</span><h2>{view === "Reports" ? tab + " report" : (resource?.title ?? tab) + " records"}</h2><p>{resource?.description}</p></div></div>{loading ? <div className="empty-state">Loading {tab.toLowerCase()}…</div> : rows.length && resource ? <div className="table-scroll"><table className="data-table module-table"><thead><tr>{resource.columns.map((column) => <th scope="col" key={column}>{column}</th>)}{(resource.canUpdate || resource.canDelete) && <th scope="col">Actions</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={row.id + "-" + index}>{index === 0 ? <strong className="module-primary-cell">{cell}</strong> : <span className="module-cell-text">{cell}</span>}</td>)}{(resource.canUpdate || resource.canDelete) && <td className="record-actions">{resource.canUpdate && resource.fields.length > 0 && <button className="icon-button" aria-label={"Edit " + row.cells[0]} onClick={() => { setEditing(row); setAdding(true); }}><Pencil size={14} /></button>}{resource.canDelete && <button className="icon-button record-delete" aria-label={"Remove " + row.cells[0]} onClick={() => void remove(row)}><Trash2 size={14} /></button>}</td>}</tr>)}</tbody></table></div> : <div className="empty-state"><strong>No {tab.toLowerCase()} records found</strong><span>Records will appear here when your team adds them.</span></div>}<div className="table-pagination"><span>Showing <strong>{rows.length}</strong> {tab.toLowerCase()} records</span><button className="button button-secondary button-compact" onClick={() => void load()}><RefreshCw size={13} /> Refresh</button></div></section>
  </>;
}
