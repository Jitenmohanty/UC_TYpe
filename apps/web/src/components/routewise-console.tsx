"use client";

import {
  Activity, ArrowRight, ArrowUpRight, BadgeIndianRupee,
  Bell, BusFront, CalendarDays, CalendarRange, ChartColumn,
  CheckCircle2, ChevronLeft, ChevronRight, CircleHelp,
  Clock3, Command, ContactRound, CreditCard, Download,
  LayoutDashboard, MapPin, Menu, MoreHorizontal, Navigation,
  Plus, Route, Search, Settings2, ShieldCheck, Sparkles, Store, TrendingUp,
  UsersRound, WalletCards, X, LogOut
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type ApiUser } from "@/lib/api";
import { TeamManager } from "@/components/team-manager";
import { ModuleWorkspace } from "@/components/module-workspace";

type TripStatus = "Confirmed" | "Enquiry" | "Ongoing" | "Completed" | "Cancelled";
type Booking = {
  id: string;
  recordId: string;
  tripStart: string;
  guest: string;
  initials: string;
  route: string;
  date: string;
  time: string;
  vehicle: string;
  status: TripStatus;
  amount: number;
  paid: number;
  customerEmail?: string;
  customerPhone?: string;
  referencePerson?: string;
  vehicleId?: string;
  driverId?: string;
  assignmentStart?: string;
  assignmentEnd?: string;
};
type ViewKey = "Overview" | "Bookings" | "Fleet" | "Drivers" | "Customers" | "Vendors" | "Accounts" | "Reports" | "Team";

const navigation: { label: ViewKey; icon: LucideIcon; count?: string }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Bookings", icon: CalendarDays, count: "12" },
  { label: "Fleet", icon: BusFront },
  { label: "Drivers", icon: ContactRound },
  { label: "Customers", icon: UsersRound },
  { label: "Vendors", icon: Store },
  { label: "Accounts", icon: WalletCards },
  { label: "Reports", icon: ChartColumn }
];
const noModules: string[] = [];

type DashboardData = {
  metrics: { totalBookings: number; revenue?: string; collected?: string; pendingPayments?: string; expenses?: string; profit?: string; upcomingTrips: number; vehicles: number };
  trend: { day: string; revenue: string; expenses: string }[];
  upcoming: ApiBooking[];
  recentBookings: ApiBooking[];
};
type ApiBooking = { id: string; serialNo: string; customerName: string; customerEmail?: string | null; customerPhone?: string | null; destination: string; startDate: string; totalAmount?: string; advanceAmount?: string; receivedAmount?: string; status: string; referencePerson?: { name: string } | null; assignments?: { vehicleId?: string | null; driverId?: string | null; startAt?: string; endAt?: string; vehicle?: { registrationNo: string; type: string } | null; driver?: { name: string } | null }[] };
type FleetVehicleOption = { id: string; registrationNo: string; type: string };
type DriverOption = { id: string; name: string; phone: string };

function mapBooking(item: ApiBooking): Booking {
  const date = new Date(item.startDate);
  const assigned = item.assignments?.[0];
  const vehicle = assigned?.vehicle ? `${assigned.vehicle.registrationNo} · ${assigned.vehicle.type}` : "Vehicle to be assigned";
  const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
  return { recordId: item.id, id: item.serialNo, tripStart: item.startDate, guest: item.customerName, customerEmail: item.customerEmail ?? undefined, customerPhone: item.customerPhone ?? undefined, initials: item.customerName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(), route: item.destination, date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), time, vehicle, vehicleId: item.assignments?.[0]?.vehicleId ?? undefined, driverId: item.assignments?.[0]?.driverId ?? undefined, assignmentStart: item.assignments?.[0]?.startAt, assignmentEnd: item.assignments?.[0]?.endAt, referencePerson: item.referencePerson?.name, status: item.status[0] + item.status.slice(1).toLowerCase() as TripStatus, amount: Number(item.totalAmount ?? 0), paid: Number(item.receivedAmount ?? item.advanceAmount ?? 0) };
}

function localDateTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const moduleContent: Record<Exclude<ViewKey, "Overview" | "Bookings" | "Team">, {
  eyebrow: string; description: string; metrics: { label: string; value: string; note: string }[];
  columns: string[]; rows: string[][]; action: string;
}> = {
  Fleet: {
    eyebrow: "VEHICLES & READINESS", description: "Keep every vehicle trip-ready and paperwork current.", action: "Add vehicle",
    metrics: [{ label: "Total vehicles", value: "27", note: "Across 3 categories" }, { label: "Available today", value: "24", note: "89% fleet readiness" }, { label: "Documents due", value: "03", note: "Within 30 days" }],
    columns: ["Vehicle", "Category", "Capacity", "Next assignment", "Documents", "Status"],
    rows: [["MH 02 · AB 4832", "Premium SUV", "6 seats", "12 Oct · 06:30", "Insurance · 04 Nov", "Ready"], ["MH 12 · CD 9021", "Traveller", "17 seats", "12 Oct · 07:15", "Permit · 18 Oct", "Due soon"], ["MH 04 · EF 1840", "Comfort SUV", "7 seats", "12 Oct · 09:00", "All current", "Ready"], ["MH 15 · GH 7501", "Traveller", "17 seats", "13 Oct · 05:45", "Fitness · 29 Oct", "Ready"]]
  },
  Drivers: {
    eyebrow: "PEOPLE ON THE ROAD", description: "Manage driver availability, licences and upcoming assignments.", action: "Add driver",
    metrics: [{ label: "Active drivers", value: "31", note: "4 on leave today" }, { label: "On assignment", value: "18", note: "Across 14 trips" }, { label: "Licence renewals", value: "02", note: "Due this month" }],
    columns: ["Driver", "Contact", "Licence", "Today", "Next trip", "Status"],
    rows: [["Devendra Patil", "+91 98201 43820", "MH-DL-0921", "Mumbai → Nashik", "12 Oct · 06:30", "On trip"], ["Akash Jadhav", "+91 98670 12045", "MH-DL-1882", "Pune → Mahabaleshwar", "12 Oct · 07:15", "On trip"], ["Sanjay More", "+91 97654 66010", "MH-DL-2401", "Available", "13 Oct · 08:00", "Available"], ["Vikram Shinde", "+91 98900 99124", "MH-DL-1170", "Off duty", "14 Oct · 22:00", "Off duty"]]
  },
  Customers: {
    eyebrow: "GUEST RELATIONSHIPS", description: "A shared view of your repeat guests and active requests.", action: "Add customer",
    metrics: [{ label: "Total customers", value: "1,284", note: "58 added this month" }, { label: "Repeat guests", value: "38%", note: "Up 6% this quarter" }, { label: "Open enquiries", value: "19", note: "Needs a follow-up" }],
    columns: ["Customer", "Contact", "Last trip", "Bookings", "Lifetime value", "Segment"],
    rows: [["Aarav Mehta", "aarav.m@example.in", "28 Sep 2026", "08 trips", "₹1,42,800", "Returning"], ["Sana Kapoor", "sana.k@example.in", "14 Aug 2026", "05 trips", "₹96,400", "Returning"], ["Ishaan Desai", "ishaan.d@example.in", "New enquiry", "01 trip", "₹9,600", "New"], ["Rhea Nair", "rhea.n@example.in", "11 Oct 2026", "03 trips", "₹68,200", "Returning"]]
  },
  Vendors: {
    eyebrow: "PARTNER NETWORK", description: "Track partner services and settle vendor dues on time.", action: "Add vendor",
    metrics: [{ label: "Active partners", value: "42", note: "Across 8 service types" }, { label: "Due this week", value: "₹68,400", note: "11 open invoices" }, { label: "Paid this month", value: "₹3.2L", note: "31 settlements" }],
    columns: ["Vendor", "Service", "Contact", "Open amount", "Next settlement", "Status"],
    rows: [["Western Roadways", "Coach hire", "+91 98220 44110", "₹18,500", "14 Oct 2026", "Due"], ["Sahyadri Stays", "Hotel partner", "+91 92255 88290", "₹24,000", "15 Oct 2026", "Due"], ["Coastal Cabs", "Local transfers", "+91 98901 77320", "₹0", "—", "Settled"], ["Trailside Tours", "Experiences", "+91 97660 42000", "₹25,900", "17 Oct 2026", "Due"]]
  },
  Accounts: {
    eyebrow: "MONEY IN MOTION", description: "Follow collections, vendor settlements and operating expenses.", action: "Record payment",
    metrics: [{ label: "Collected this month", value: "₹4.82L", note: "18% over last month" }, { label: "Outstanding", value: "₹86,420", note: "Across 12 bookings" }, { label: "Vendor dues", value: "₹68,400", note: "11 invoices open" }],
    columns: ["Reference", "Customer / Partner", "Type", "Due date", "Amount", "Status"],
    rows: [["BK-2026-0184", "Aarav Mehta", "Balance due", "12 Oct 2026", "₹10,400", "Due soon"], ["VN-2026-0081", "Western Roadways", "Vendor payout", "14 Oct 2026", "₹18,500", "Pending"], ["BK-2026-0177", "Aditi Rao", "Trip payment", "11 Oct 2026", "₹22,600", "Received"], ["VN-2026-0078", "Sahyadri Stays", "Vendor payout", "15 Oct 2026", "₹24,000", "Pending"]]
  },
  Reports: {
    eyebrow: "A CLEARER VIEW", description: "Useful numbers for the trips and decisions ahead.", action: "Build report",
    metrics: [{ label: "Net revenue", value: "₹2.14L", note: "This month to date" }, { label: "Trip completion", value: "96.4%", note: "Last 30 days" }, { label: "Avg. booking", value: "₹18,240", note: "Across 126 trips" }],
    columns: ["Report", "Period", "Updated", "Includes", "Owner", "Format"],
    rows: [["Booking history", "Sep 2026", "Today · 09:14", "126 bookings", "Priti Shah", "XLSX · PDF"], ["Outstanding balances", "Oct 2026", "Today · 08:52", "12 balances", "Priti Shah", "XLSX · PDF"], ["Fleet utilisation", "Q3 2026", "10 Oct · 17:40", "27 vehicles", "Priti Shah", "XLSX · PDF"], ["Vendor dues", "Oct 2026", "09 Oct · 14:22", "11 invoices", "Priti Shah", "XLSX · PDF"]]
  }
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function downloadCsv(fileName: string, columns: string[], rows: string[][]) {
  const csv = [columns, ...rows].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBookings(bookings: Booking[]) {
  downloadCsv("routewise-bookings.csv", ["Booking", "Guest", "Route", "Travel date", "Pickup time", "Vehicle", "Status", "Total INR", "Paid INR"], bookings.map((booking) => [
    booking.id, booking.guest, booking.route, booking.date, booking.time, booking.vehicle, booking.status, String(booking.amount), String(booking.paid)
  ]));
}

function exportModule(view: Exclude<ViewKey, "Overview" | "Bookings" | "Team">, query: string) {
  const moduleData = moduleContent[view];
  const rows = moduleData.rows.filter((row) => !query || row.join(" ").toLowerCase().includes(query.toLowerCase()));
  downloadCsv(`routewise-${view.toLowerCase()}.csv`, moduleData.columns, rows);
}

function StatusPill({ status }: { status: string }) {
  const tone = status.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${tone}`}><span className="status-dot" />{status}</span>;
}

function Avatar({ initials, index = 0 }: { initials: string; index?: number }) {
  return <span className={`avatar avatar-${index % 5}`} aria-hidden="true">{initials}</span>;
}

function BrandMark() {
  return <span className="brand-mark"><Route size={20} strokeWidth={2.2} aria-hidden="true" /></span>;
}

export function RoutewiseConsole({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [activeView, setActiveView] = useState<ViewKey>("Overview");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All trips");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState(false);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [vehicleOptions, setVehicleOptions] = useState<FleetVehicleOption[]>([]);
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([]);
  const [assignmentBusy, setAssignmentBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const detailDialogRef = useRef<HTMLDialogElement>(null);
  const tenantName = user.tenant?.name ?? "Workspace";
  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const isAdmin = user.role === "TENANT_ADMIN";
  const workspaceModules = user.modules ?? noModules;
  const can = useCallback((permission: string) => isAdmin || user.permissions.includes(permission), [isAdmin, user.permissions]);
  const visibleNavigation = useMemo(() => navigation.filter(({ label }) => {
    if (label === "Overview") return workspaceModules.includes("bookings") && can("dashboard.view");
    if (label === "Bookings") return workspaceModules.includes("bookings") && can("booking.view");
    if (label === "Fleet") return workspaceModules.includes("fleet") && can("vehicle.view");
    if (label === "Drivers") return workspaceModules.includes("fleet") && can("driver.view");
    if (label === "Customers") return workspaceModules.includes("customers") && can("customer.view");
    if (label === "Vendors") return workspaceModules.includes("accounts") && can("vendor.view");
    if (label === "Accounts") return workspaceModules.includes("accounts") && ["payment.view", "expense.view", "invoice.view", "receipt.view", "commission.view"].some(can);
    if (label === "Reports") return workspaceModules.includes("reports") && can("report.view");
    return false;
  }).concat((isAdmin || (can("employee.manage") && can("role.manage"))) ? [{ label: "Team" as const, icon: UsersRound }] : []), [workspaceModules, can, isAdmin]);

  const refreshData = useCallback(async () => {
    setDataLoading(true); setDataError("");
    try {
      const tasks: Promise<void>[] = [];
      if (workspaceModules.includes("bookings") && can("booking.view")) {
        tasks.push(api.get<{ items: ApiBooking[] }>("/bookings?page=1&pageSize=50&sort=startDate&direction=asc").then(({ items }) => setBookings(items.map(mapBooking))));
      }
      if (workspaceModules.includes("bookings") && can("dashboard.view")) {
        tasks.push(api.get<DashboardData>("/dashboard").then(setDashboard));
      }
      await Promise.all(tasks);
    } catch (cause) { setDataError(cause instanceof Error ? cause.message : "Could not load workspace data."); }
    finally { setDataLoading(false); }
  }, [workspaceModules, can]);

  useEffect(() => { void refreshData(); }, [refreshData, user.id]);
  useEffect(() => { if (!visibleNavigation.some((entry) => entry.label === activeView)) setActiveView(visibleNavigation[0]?.label ?? "Team"); }, [visibleNavigation, activeView]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const dialog = createDialogRef.current;
    if (dialogOpen && dialog && !dialog.open) dialog.showModal();
    if (!dialogOpen && dialog?.open) dialog.close();
  }, [dialogOpen]);

  useEffect(() => {
    const dialog = detailDialogRef.current;
    if (selectedBooking && dialog && !dialog.open) dialog.showModal();
    if (!selectedBooking && dialog?.open) dialog.close();
  }, [selectedBooking]);
  useEffect(() => { setEditingBooking(false); }, [selectedBooking?.recordId]);

  const loadFleetOptions = useCallback(() => {
    if (!selectedBooking || !workspaceModules.includes("fleet")) return;
    if (can("vehicle.view")) void api.get<{ items: FleetVehicleOption[] }>("/vehicles?pageSize=100").then((data) => setVehicleOptions(data.items)).catch(() => setVehicleOptions([]));
    if (can("driver.view")) void api.get<{ items: DriverOption[] }>("/drivers?pageSize=100").then((data) => setDriverOptions(data.items)).catch(() => setDriverOptions([]));
  }, [selectedBooking, workspaceModules, can]);
  useEffect(() => { loadFleetOptions(); }, [loadFleetOptions]);

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const matchesQuery = !query || `${booking.id} ${booking.guest} ${booking.route} ${booking.vehicle}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "All trips" || booking.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [bookings, query, statusFilter]);

  const openView = (view: ViewKey) => {
    setActiveView(view);
    setMobileNavOpen(false);
    setStatusFilter("All trips");
  };

  const saveAssignment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBooking) return;
    const form = new FormData(event.currentTarget);
    const vehicleId = String(form.get("vehicleId") || "");
    const driverId = String(form.get("driverId") || "");
    if (!vehicleId && !driverId) { setNotice("Choose a vehicle, a driver, or both before saving."); return; }
    setAssignmentBusy(true);
    try {
      await api.put("/bookings/" + selectedBooking.recordId + "/assignment", {
        ...(vehicleId ? { vehicleId } : {}), ...(driverId ? { driverId } : {}),
        startAt: new Date(String(form.get("startAt"))).toISOString(), endAt: new Date(String(form.get("endAt"))).toISOString()
      });
      const fresh = await api.get<ApiBooking>("/bookings/" + selectedBooking.recordId);
      setSelectedBooking(mapBooking(fresh));
      setNotice("Vehicle and driver assignment saved.");
      await refreshData();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Assignment could not be saved."); }
    finally { setAssignmentBusy(false); }
  };

  const updateBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBooking) return;
    const form = new FormData(event.currentTarget);
    setBookingBusy(true);
    try {
      await api.patch("/bookings/" + selectedBooking.recordId, {
        customerName: String(form.get("guest")), customerEmail: String(form.get("email") || ""), customerPhone: String(form.get("phone") || ""), destination: String(form.get("destination")),
        startDate: new Date(String(form.get("startAt"))).toISOString(),
        ...(can("payment.update") && can("payment.view") ? { totalAmount: String(form.get("amount")) } : {}), status: String(form.get("status")),
        referencePersonName: String(form.get("referencePerson") || "")
      });
      const fresh = await api.get<ApiBooking>("/bookings/" + selectedBooking.recordId);
      setSelectedBooking(mapBooking(fresh));
      setEditingBooking(false);
      setNotice("Booking changes saved.");
      await refreshData();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Booking changes could not be saved."); }
    finally { setBookingBusy(false); }
  };

  const createBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const guest = String(form.get("guest") || "New customer").trim();
    const start = String(form.get("date") || "");
    const time = String(form.get("time") || "08:00");
    const amount = String(form.get("amount") || "0");
    const advance = String(form.get("advance") || "0");
    if (Number(advance) > Number(amount)) {
      setNotice("Advance received cannot be greater than the booking amount.");
      return;
    }
    try {
      const saved = await api.post<ApiBooking>("/bookings", {
        customerName: guest,
        customerPhone: String(form.get("phone") || ""),
        customerEmail: String(form.get("email") || ""),
        referencePersonName: String(form.get("referencePerson") || ""),
        destination: String(form.get("route") || ""),
        startDate: new Date(`${start}T${time}:00`).toISOString(),
        totalAmount: amount,
        advanceAmount: advance,
        status: "ENQUIRY"
      });
      const created = mapBooking(saved);
      setBookings((current) => [created, ...current]);
      setActiveView("Bookings");
      setDialogOpen(false);
      setNotice(`Booking ${created.id} saved to the workspace.`);
      await refreshData();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Booking could not be saved.");
    }
  };

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-top">
          <a className="brand" href="#main-content" onClick={(event) => { event.preventDefault(); openView("Overview"); }}>
            <BrandMark /><span className="brand-name">routewise</span><span className="brand-period">.</span>
          </a>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        </div>

        <div className="workspace-switcher">
          <span className="workspace-monogram">{tenantName.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>{tenantName}</strong><small>Business workspace</small></span>
        </div>

        <nav className="sidebar-nav" aria-label="Workspace">
          <p className="nav-label">WORKSPACE</p>
          {visibleNavigation.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-link ${activeView === label ? "nav-link-active" : ""}`} aria-current={activeView === label ? "page" : undefined} onClick={() => openView(label)}>
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
              {label === "Bookings" && <span className="nav-count">{bookings.length}</span>}
            </button>
          ))}
          <div className="nav-divider" />
          <p className="nav-label">PREFERENCES</p>
          <button className="nav-link" onClick={() => setNotice("Workspace settings will be available here.")}><Settings2 size={18} strokeWidth={1.8} aria-hidden="true" /><span>Settings</span></button>
          <button className="nav-link" onClick={() => setNotice("The Routewise help centre is coming soon.")}><CircleHelp size={18} strokeWidth={1.8} aria-hidden="true" /><span>Help centre</span></button>
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-note">
            <span className="upgrade-icon"><Sparkles size={16} aria-hidden="true" /></span>
            <div><strong>Make every trip count</strong><p>Explore your monthly overview.</p></div>
            <button className="upgrade-arrow" aria-label="Open monthly overview" onClick={() => openView("Reports")}><ArrowUpRight size={15} /></button>
          </div>
          <div className="profile-summary">
            <Avatar initials={initials} index={2} />
            <span className="profile-copy"><strong>{user.name}</strong><small>{isAdmin ? "Workspace admin" : "Employee"}</small></span>
            <button className="icon-button signout-button" onClick={onLogout} aria-label="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>{tenantName}</span><ChevronRight size={14} aria-hidden="true" /><strong>{activeView}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={16} aria-hidden="true" />
              <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search anything..." aria-label="Search bookings and workspace" />
              <span className="shortcut"><Command size={11} aria-hidden="true" /> K</span>
            </label>
            <span className="topbar-divider" />
            <button className="icon-button notification-button" aria-label="Notifications, 3 unread" onClick={() => setNotice("You have 3 updates: two payment reminders and one permit renewal.")}><Bell size={18} /><i /></button>
            <Avatar initials={initials} index={2} />
          </div>
        </header>

        <main id="main-content" className="main-content" tabIndex={-1}>
          {notice && <div role="status" className="toast"><CheckCircle2 size={17} aria-hidden="true" /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15} /></button></div>}
          {dataError && <div role="alert" className="toast toast-error"><X size={16} /><span>{dataError}</span><button aria-label="Retry loading workspace data" onClick={() => void refreshData()}>Retry</button></div>}
          {activeView === "Overview" && (dashboard ? <Dashboard bookings={bookings} data={dashboard} userName={user.name} canViewFinancial={can("payment.view")} onCreate={() => setDialogOpen(true)} canCreate={can("booking.create")} onViewBookings={() => openView("Bookings")} onViewFleet={() => openView("Fleet")} onSelect={setSelectedBooking} /> : <div className="empty-state dashboard-loading" role="status">{dataLoading ? "Loading your business overview…" : "Overview data is not available to this role."}</div>)}
          {activeView === "Bookings" && <BookingsPage bookings={filteredBookings} query={query} statusFilter={statusFilter} onStatusChange={setStatusFilter} canCreate={can("booking.create")} canExport={can("report.export")} showFinancial={can("payment.view")} onCreate={() => setDialogOpen(true)} onSelect={setSelectedBooking} onExport={() => exportBookings(filteredBookings)} />}
          {activeView === "Team" && <TeamManager />}
          {activeView !== "Overview" && activeView !== "Bookings" && activeView !== "Team" && <ModulePage view={activeView} query={query} user={user} onAction={() => setNotice(`${moduleContent[activeView].action} is ready to connect to the workspace.`)} onExport={() => exportModule(activeView, query)} />}
        </main>
        <footer className="app-footer"><span>Routewise <span className="footer-dot">·</span> {tenantName}</span><span><span className={`online-dot ${dataError ? "offline-dot" : ""}`} /> {dataError ? "Data connection needs attention" : "Workspace data connected"}</span></footer>
      </div>

      <dialog ref={createDialogRef} className="modal-dialog booking-dialog" aria-labelledby="create-booking-title" onClose={() => setDialogOpen(false)}>
        <div className="dialog-heading"><div><span className="eyebrow">NEW TRIP</span><h2 id="create-booking-title">Create a booking</h2><p>Add the guest and trip details to get started.</p></div><button className="icon-button" onClick={() => setDialogOpen(false)} aria-label="Close create booking dialog"><X size={18} /></button></div>
        <form className="booking-form" onSubmit={createBooking}>
          <div className="form-grid">
            <label className="form-field field-full">Guest name<input name="guest" autoFocus required minLength={2} placeholder="e.g. Aditi Rao" /></label>
            <label className="form-field">Phone number<input name="phone" type="tel" required minLength={7} placeholder="+91 98765 43210" /></label>
            <label className="form-field">Email <span className="optional-label">Optional</span><input name="email" type="email" placeholder="guest@example.com" /></label>
            <label className="form-field field-full">Route / destination<input name="route" required placeholder="Mumbai → Pune" /></label>
            <label className="form-field field-full">Reference person <span className="optional-label">Optional</span><input name="referencePerson" placeholder="Who referred this guest?" /></label>
            <label className="form-field">Travel date<input name="date" type="date" required /></label>
            <label className="form-field">Pickup time<input name="time" type="time" defaultValue="08:00" required /></label>
            <label className="form-field">Booking amount <span className="form-prefix">₹</span><input className="has-prefix" name="amount" type="number" min="0" step="1" required placeholder="0" /></label>
            {can("payment.create") && <label className="form-field">Advance received <span className="form-prefix">₹</span><input className="has-prefix" name="advance" type="number" min="0" step="0.01" defaultValue="0" /></label>}
          </div>
          <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setDialogOpen(false)}>Cancel</button><button type="submit" className="button button-primary"><Plus size={16} /> Add booking</button></div>
        </form>
      </dialog>

      <dialog ref={detailDialogRef} className="modal-dialog detail-dialog" aria-labelledby="booking-detail-title" onClose={() => setSelectedBooking(null)}>
        {selectedBooking && <>
          <div className="dialog-heading"><div><span className="eyebrow">BOOKING DETAILS</span><h2 id="booking-detail-title">{selectedBooking.id}</h2><p>Created for {selectedBooking.guest}</p></div><button className="icon-button" onClick={() => setSelectedBooking(null)} aria-label="Close booking details"><X size={18} /></button></div>
          {editingBooking ? <form className="booking-form" onSubmit={updateBooking} key={selectedBooking.recordId}>
            <div className="form-grid">
              <label className="form-field field-full">Guest name<input name="guest" required minLength={2} defaultValue={selectedBooking.guest} /></label>
              <label className="form-field">Phone number<input name="phone" type="tel" required minLength={7} defaultValue={selectedBooking.customerPhone ?? ""} /></label>
              <label className="form-field">Email<input name="email" type="email" defaultValue={selectedBooking.customerEmail ?? ""} /></label>
              <label className="form-field field-full">Destination<input name="destination" required minLength={2} defaultValue={selectedBooking.route} /></label>
              <label className="form-field field-full">Trip date and pickup time<input name="startAt" type="datetime-local" required defaultValue={localDateTime(selectedBooking.tripStart)} /></label>
              <label className="form-field field-full">Reference person<input name="referencePerson" defaultValue={selectedBooking.referencePerson ?? ""} /></label>
              {can("payment.update") && can("payment.view") && <label className="form-field">Booking total<input name="amount" type="number" min="0" step="0.01" required defaultValue={selectedBooking.amount} /></label>}
              <label className="form-field">Trip status<select name="status" defaultValue={selectedBooking.status.toUpperCase()}>{["ENQUIRY", "CONFIRMED", "ONGOING", "COMPLETED", "CANCELLED"].map((status) => <option key={status} value={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}</select></label>
            </div>
            <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setEditingBooking(false)}>Cancel</button><button className="button button-primary" disabled={bookingBusy}>{bookingBusy ? "Saving…" : "Save booking"}</button></div>
          </form> : <>
            <div className="detail-route"><span className="route-pin"><Navigation size={17} /></span><div><strong>{selectedBooking.route}</strong><small>{selectedBooking.date} · {selectedBooking.time}</small></div><StatusPill status={selectedBooking.status} /></div>
            <div className="detail-grid"><div><small>Guest</small><strong>{selectedBooking.guest}</strong></div><div><small>Phone</small><strong>{selectedBooking.customerPhone || "—"}</strong></div><div><small>Email</small><strong>{selectedBooking.customerEmail || "—"}</strong></div><div><small>Vehicle</small><strong>{selectedBooking.vehicle}</strong></div><div><small>Reference person</small><strong>{selectedBooking.referencePerson || "—"}</strong></div>{can("payment.view") && <><div><small>Trip total</small><strong>{money(selectedBooking.amount)}</strong></div><div><small>Paid to date</small><strong>{money(selectedBooking.paid)}</strong></div><div><small>Balance due</small><strong>{money(selectedBooking.amount - selectedBooking.paid)}</strong></div></>}</div>
            <div className="detail-note"><Clock3 size={16} /><span>{selectedBooking.status === "Enquiry" ? "Follow up with the guest to confirm this trip." : "Trip details are saved in the booking register."}</span></div>
            {can("booking.update") && workspaceModules.includes("fleet") && (can("vehicle.view") || can("driver.view")) && <form className="booking-form assignment-form" onSubmit={saveAssignment}>
              <div className="assignment-title"><span className="eyebrow">FLEET DISPATCH</span><strong>Assign vehicle and driver</strong></div>
              <div className="form-grid">
                {can("vehicle.view") && <label className="form-field">Vehicle<select name="vehicleId" defaultValue={selectedBooking.vehicleId ?? ""}><option value="">No vehicle</option>{vehicleOptions.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registrationNo} · {vehicle.type}</option>)}</select></label>}
                {can("driver.view") && <label className="form-field">Driver<select name="driverId" defaultValue={selectedBooking.driverId ?? ""}><option value="">No driver</option>{driverOptions.map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.phone}</option>)}</select></label>}
                <label className="form-field">Assignment starts<input name="startAt" type="datetime-local" required defaultValue={localDateTime(selectedBooking.assignmentStart ?? selectedBooking.tripStart)} /></label>
                <label className="form-field">Assignment ends<input name="endAt" type="datetime-local" required defaultValue={localDateTime(selectedBooking.assignmentEnd ?? new Date(new Date(selectedBooking.tripStart).getTime() + 8 * 60 * 60 * 1000).toISOString())} /></label>
              </div>
              <div className="dialog-actions"><button className="button button-primary" disabled={assignmentBusy}>{assignmentBusy ? "Saving assignment…" : "Save assignment"}</button></div>
            </form>}
            <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setSelectedBooking(null)}>Close</button>{can("booking.update") && <button type="button" className="button button-primary" onClick={() => setEditingBooking(true)}>Edit booking</button>}</div>
          </>}
        </>}
      </dialog>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action, onAction, secondaryAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void; secondaryAction?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{secondaryAction}{action && onAction && <button className="button button-primary" onClick={onAction}><Plus size={16} />{action}</button>}</div></div>;
}

function Dashboard({ bookings, data, userName, canViewFinancial, onCreate, canCreate, onViewBookings, onViewFleet, onSelect }: { bookings: Booking[]; data: DashboardData; userName: string; canViewFinancial: boolean; onCreate: () => void; canCreate: boolean; onViewBookings: () => void; onViewFleet: () => void; onSelect: (booking: Booking) => void }) {
  const upcoming = data.upcoming.map(mapBooking);
  const recentBookings = data.recentBookings.map(mapBooking);
  const chartData = data.trend.map((point) => ({ day: point.day, revenue: Number(point.revenue) / 1000, expenses: Number(point.expenses) / 1000 }));
  const collectedTotal = data.metrics.collected;
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return <>
    <div className="dashboard-heading">
      <div><span className="eyebrow">{today.toUpperCase()}</span><h1>Good morning, {userName.split(" ")[0]} <span className="greeting-wave">✳</span></h1><p>Here’s what’s happening across your travel desk today.</p></div>
      <div className="heading-actions"><span className="date-range-label"><CalendarRange size={16} /> This month</span>{canCreate && <button className="button button-primary" onClick={onCreate}><Plus size={16} /> New booking</button>}</div>
    </div>

    <section className="metric-grid" aria-label="Key business metrics">
      <MetricCard label="Total bookings" value={String(data.metrics.totalBookings)} change="All trips" context="Across this workspace" icon={Navigation} tone="sage" spark="M0 21 C12 18 17 20 27 14 S41 16 53 9 69 12 81 4" />
      {canViewFinancial ? <>
        <MetricCard label="Booking revenue" value={money(Number(data.metrics.revenue ?? 0))} change="Gross" context="Trips starting this month" icon={BadgeIndianRupee} tone="sand" spark="M0 20 C10 20 13 13 23 17 S39 9 49 11 60 7 68 8 73 1 81 3" />
        <MetricCard label="Collected" value={money(Number(collectedTotal ?? 0))} change="Received" context="Payments recorded this month" icon={WalletCards} tone="blue" spark="M0 12 C8 8 16 17 25 12 S38 4 47 13 60 19 69 8 76 11 81 5" />
        <MetricCard label="Pending payments" value={money(Number(data.metrics.pendingPayments ?? 0))} change="Balance" context="For this month’s trips" icon={CreditCard} tone="peach" spark="M0 12 C8 8 16 17 25 12 S38 4 47 13 60 19 69 8 76 11 81 5" inverse />
        <MetricCard label="Operating expenses" value={money(Number(data.metrics.expenses ?? 0))} change="Recorded" context="This month" icon={Activity} tone="sand" spark="M0 17 C12 18 19 13 27 14 S42 6 50 10 62 8 69 3 76 5 81 2" />
        <MetricCard label="Net profit" value={money(Number(data.metrics.profit ?? 0))} change="Estimate" context="After vendor payments & commissions" icon={TrendingUp} tone="sage" spark="M0 20 C10 20 13 13 23 17 S39 9 49 11 60 7 68 8 73 1 81 3" />
      </> : <>
        <MetricCard label="Upcoming trips" value={String(data.metrics.upcomingTrips)} change="Next 7 days" context="Confirmed and ongoing trips" icon={CalendarRange} tone="blue" spark="M0 21 C12 18 17 20 27 14 S41 16 53 9 69 12 81 4" />
        <MetricCard label="Vehicles" value={String(data.metrics.vehicles)} change="Fleet" context="Registered in this workspace" icon={BusFront} tone="sand" spark="M0 20 C10 20 13 13 23 17 S39 9 49 11 60 7 68 8 73 1 81 3" />
      </>}
    </section>

    <div className="dashboard-grid">
      {canViewFinancial && <section className="panel revenue-panel" aria-labelledby="revenue-title">
        <div className="panel-heading"><div><span className="eyebrow">PERFORMANCE</span><h2 id="revenue-title">Cash flow</h2><p>Recorded collections and operating costs this month</p></div><span className="date-range-label">This month</span></div>
        <div className="chart-legend"><span><i className="legend-swatch legend-revenue" /> Collections</span><span><i className="legend-swatch legend-expenses" /> Expenses</span><strong>{money(Number(collectedTotal))} <small>collected</small></strong></div>
        <div className="chart-wrap" role="img" aria-label="Area chart showing recorded collections and expenses this month">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 5, left: -18, bottom: 0 }}>
            <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#32745a" stopOpacity={0.17} /><stop offset="100%" stopColor="#32745a" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#edf0eb" strokeDasharray="3 4" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#89948b", fontSize: 11 }} dy={9} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#89948b", fontSize: 11 }} tickFormatter={(value) => `₹${value}k`} />
            <Tooltip formatter={(value, name) => [money(Number(value) * 1000), name === "revenue" ? "Collected" : "Expenses"]} contentStyle={{ border: "1px solid #e8ece6", borderRadius: 10, boxShadow: "0 8px 24px #183b2814", fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" stroke="#31765a" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 4, fill: "#31765a", stroke: "#fff", strokeWidth: 2 }} />
            <Area type="monotone" dataKey="expenses" stroke="#d39a63" strokeWidth={2} strokeDasharray="5 4" fill="transparent" activeDot={{ r: 3, fill: "#d39a63", stroke: "#fff", strokeWidth: 2 }} />
          </AreaChart></ResponsiveContainer>
        </div>
        <div className="chart-footnote"><span><TrendingUp size={14} /> Payments and expenses posted in the selected month</span><button onClick={onViewBookings}>View all activity <ArrowRight size={14} /></button></div>
      </section>}

      <section className="panel dispatch-panel" aria-labelledby="dispatch-title">
        <div className="panel-heading"><div><span className="eyebrow">ON THE ROAD</span><h2 id="dispatch-title">Upcoming trips</h2><p>Next seven days · {data.metrics.vehicles} vehicles in fleet</p></div></div>
        <div className="departure-list">
          {upcoming.map((booking, index) => <button className="departure-item" key={booking.id} onClick={() => onSelect(booking)}>
            <span className="departure-time"><strong>{booking.time.replace(" AM", "").replace(" PM", "")}</strong><small>{booking.time.slice(-2)}</small></span>
            <span className="departure-line"><i className={`departure-node node-${index}`} /><i className="departure-connector" /></span>
            <span className="departure-main"><strong>{booking.route}</strong><small><span>{booking.guest}</span><span className="departure-vehicle"><BusFront size={12} /> {booking.vehicle.split(" · ")[1]}</span></small></span>
            <ChevronRight size={15} className="departure-chevron" />
          </button>)}
          {!upcoming.length && <div className="empty-state upcoming-empty"><strong>No upcoming trips</strong><span>Confirmed trips for the next seven days will appear here.</span></div>}
        </div>
        <button className="panel-link" onClick={onViewBookings}>Open dispatch board <ArrowRight size={14} /></button>
      </section>
    </div>

    <section className="panel booking-panel" aria-labelledby="recent-bookings-title">
      <div className="panel-heading booking-panel-heading"><div><span className="eyebrow">YOUR TRIP PIPELINE</span><h2 id="recent-bookings-title">Recent bookings</h2><p>The latest movement across your booking register</p></div><div className="table-heading-actions"><button className="button button-secondary button-compact" onClick={onViewBookings}>View register <ArrowRight size={14} /></button></div></div>
      <BookingTable bookings={recentBookings} onSelect={onSelect} compact showFinancial={canViewFinancial} />
    </section>

    <div className="bottom-grid">
      <section className="panel note-panel"><div className="note-icon"><ShieldCheck size={18} /></div><div><strong>Fleet records</strong><p>Review vehicle availability, registrations and document dates.</p></div><button aria-label="Open fleet" onClick={onViewFleet}><ArrowRight size={15} /></button></section>
      <section className="panel quick-tip"><span className="tip-icon"><Sparkles size={16} /></span><div><strong>Bookings in progress</strong><p>{bookings.length} recent booking records are available in your register.</p></div><span className="tip-count">{data.metrics.upcomingTrips} upcoming</span></section>
    </div>
  </>;
}

function MetricCard({ label, value, change, context, icon: Icon, tone, spark, inverse = false }: { label: string; value: string; change: string; context: string; icon: LucideIcon; tone: string; spark: string; inverse?: boolean }) {
  return <article className="metric-card"><div className="metric-card-top"><span className={`metric-icon metric-icon-${tone}`}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span><span className={`metric-change ${inverse ? "metric-change-warm" : ""}`}>{!inverse && <ArrowUpRight size={13} />}{change}</span></div><p className="metric-label">{label}</p><div className="metric-value-row"><strong>{value}</strong><svg className="metric-spark" viewBox="0 0 82 26" aria-hidden="true"><path d={spark} fill="none" stroke={inverse ? "#d39366" : "#4d9270"} strokeWidth="2" strokeLinecap="round" /></svg></div><p className="metric-context">{context}</p></article>;
}

function BookingsPage({ bookings, query, statusFilter, onStatusChange, canCreate, canExport, showFinancial, onCreate, onSelect, onExport }: { bookings: Booking[]; query: string; statusFilter: string; onStatusChange: (status: string) => void; canCreate: boolean; canExport: boolean; showFinancial: boolean; onCreate: () => void; onSelect: (booking: Booking) => void; onExport: () => void }) {
  const statuses = ["All trips", "Confirmed", "Enquiry", "Ongoing", "Completed"];
  return <>
    <PageHeading eyebrow="TRIP PIPELINE" title="Booking register" description="Every request, confirmation and departure in one place." action={canCreate ? "New booking" : undefined} onAction={onCreate} secondaryAction={canExport ? <button className="button button-secondary" onClick={onExport}><Download size={15} /> Export CSV</button> : undefined} />
    <section className="panel register-panel" aria-label="Booking register table">
      <div className="register-toolbar"><div className="filter-tabs" role="group" aria-label="Filter by trip status">{statuses.map((status) => <button key={status} className={`filter-tab ${statusFilter === status ? "filter-tab-active" : ""}`} aria-pressed={statusFilter === status} onClick={() => onStatusChange(status)}>{status}{status === "All trips" && <span>{bookings.length}</span>}</button>)}</div><div className="register-tools">{canExport && <button className="button button-secondary button-compact" onClick={onExport}><Download size={14} /> Export CSV</button>}</div></div>
      {query && <p className="search-result-caption">Showing matches for <strong>“{query}”</strong></p>}
      <BookingTable bookings={bookings} onSelect={onSelect} showFinancial={showFinancial} />
      <div className="table-pagination"><span>Showing <strong>{bookings.length ? 1 : 0}–{bookings.length}</strong> of <strong>{bookings.length}</strong> bookings</span><div><button className="pagination-button" aria-label="Previous page" disabled><ChevronLeft size={15} /></button><button className="pagination-current" aria-current="page">1</button><button className="pagination-button" aria-label="Next page" disabled><ChevronRight size={15} /></button></div></div>
    </section>
    <div className="module-footnote"><ShieldCheck size={15} /><span>Booking records are private to the Western Trails workspace.</span></div>
  </>;
}

function BookingTable({ bookings, onSelect, compact = false, showFinancial = false }: { bookings: Booking[]; onSelect: (booking: Booking) => void; compact?: boolean; showFinancial?: boolean }) {
  if (!bookings.length) return <div className="empty-state" role="status"><CalendarDays size={26} /><strong>No bookings match those filters</strong><span>Try another search or choose a different trip status.</span></div>;
  return <div className="table-scroll"><table className={`data-table booking-table ${compact ? "data-table-compact" : ""}`}>
    <thead><tr><th scope="col">Booking</th><th scope="col">Guest</th><th scope="col">Route</th><th scope="col">Travel date</th><th scope="col">Trip value</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{bookings.map((booking, index) => <tr key={booking.id}>
      <td><button className="booking-id" onClick={() => onSelect(booking)}>{booking.id}</button><span className="table-subline">Updated {index === 0 ? "12 min" : `${(index + 1) * 2} hr`} ago</span></td>
      <td><div className="guest-cell"><Avatar initials={booking.initials} index={index} /><span><strong>{booking.guest}</strong><small>Guest traveller</small></span></div></td>
      <td><span className="route-cell"><MapPin size={13} />{booking.route}</span><span className="table-subline">{booking.vehicle}</span></td>
      <td><span className="date-cell">{booking.date}</span><span className="table-subline">{booking.time}</span></td>
      <td>{showFinancial ? <><strong className="amount-cell">{money(booking.amount)}</strong><span className="table-subline">{booking.paid ? `${money(booking.paid)} received` : "No payment"}</span></> : <span className="module-muted-cell">Restricted</span>}</td>
      <td><StatusPill status={booking.status} /></td>
      <td><button className="icon-button row-more" aria-label={`View ${booking.id} details`} onClick={() => onSelect(booking)}><MoreHorizontal size={18} /></button></td>
    </tr>)}</tbody>
  </table></div>;
}

function ModulePage({ view, query, user, onAction, onExport }: { view: Exclude<ViewKey, "Overview" | "Bookings" | "Team">; query: string; user: ApiUser; onAction: () => void; onExport: () => void }) {
  void moduleContent[view];
  void onAction;
  void onExport;
  return <ModuleWorkspace view={view} query={query} user={user} />;
}
