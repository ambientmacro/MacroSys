import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getMenuByRole } from "../lib/roles";
import { ROLE_LABELS } from "../lib/constants";
import WhatsAppNotifier from "./WhatsAppNotifier";
import InstallAppButton from "./InstallAppButton";
import {
  House, ClipboardText, ListChecks, PlusCircle, FileText, Users, Truck,
  Stack, UserGear, Devices, SignOut, List, X, Drop, Bell,
  ChartBar, ChatCircleText, ClockClockwise, CurrencyCircleDollar, FileXls, Palette,
} from "@phosphor-icons/react";

const ICONS = {
  House, ClipboardText, ListChecks, PlusCircle, FileText, Users, Truck,
  Stack, UserGear, Devices, ChartBar, ChatCircleText, ClockClockwise,
  CurrencyCircleDollar, FileXls, Palette,
};

export default function AppLayout() {
  const { profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const menu = getMenuByRole(profile?.role);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen font-[Manrope,sans-serif]" style={{ background: "var(--app-bg)", color: "var(--app-text)" }}>
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3"
        style={{ background: "var(--app-sidebar-bg)", color: "var(--app-sidebar-fg)" }}>
        <button onClick={() => setOpen(!open)} data-testid="mobile-menu-btn" className="p-2 -ml-2" style={{ color: "var(--app-sidebar-fg)" }}>
          {open ? <X size={22} /> : <List size={22} />}
        </button>
        <div className="flex items-center gap-2">
          <Drop size={22} weight="fill" style={{ color: "var(--app-primary)" }} />
          <span className="font-[Outfit,sans-serif] font-black tracking-tight">MACRO AMBIENTAL</span>
        </div>
        <button onClick={handleLogout} data-testid="mobile-logout" className="p-2 -mr-2" style={{ color: "var(--app-sidebar-fg)" }}><SignOut size={20} /></button>
      </header>

      <div className="flex">
        {/* Sidebar — cor controlada pelo tema do perfil (var --app-sidebar-bg). */}
        <aside
          data-testid="app-sidebar"
          style={{ background: "var(--app-sidebar-bg)", color: "var(--app-sidebar-fg)" }}
          className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          {/* Substituir pela logo?? pois está personalisável */}
          {/* Logo */}
          <div className="px-6 py-7 border-b border-white/10">
            <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: "var(--app-primary)" }}>
                <Drop size={22} weight="fill" style={{ color: "var(--app-primary-fg)" }} />
              </div>
              <div>
                <div className="font-[Outfit,sans-serif] font-black text-lg leading-none tracking-tight">MACRO</div>
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold mt-1 opacity-60">Ambiental</div>
              </div>
            </Link>
          </div>

          {/* Profile */}
          <div className="px-5 py-4 border-b border-white/10 bg-white/5">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Perfil</div>
            <div className="text-sm font-bold mt-0.5" data-testid="profile-role">
              {ROLE_LABELS[profile?.role] || "—"}
            </div>
            <div className="text-xs mt-0.5 truncate opacity-70">{profile?.name || profile?.email}</div>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
            {menu.map((item) => {
              const Icon = ICONS[item.icon] || House;
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  data-testid={`menu-${item.path.replace(/\//g, "-") || "home"}`}
                  style={active ? { background: "var(--app-primary)", color: "var(--app-primary-fg)" } : undefined}
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ${active ? "shadow-lg" : "hover:bg-white/10"}`}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} />
                  <span>{item.label}</span>
                  {active && <span className="absolute right-0 top-0 bottom-0 w-1 rounded-l-md" style={{ background: "var(--app-primary-fg)" }} />}
                </Link>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="px-3 pb-4 pt-2 border-t border-white/10 space-y-2">
            <InstallAppButton variant="sidebar" />
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="w-full flex items-center justify-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white py-3 px-4 rounded-md text-xs font-bold uppercase tracking-[0.15em] transition-all"
            >
              <SignOut size={16} weight="bold" />
              <span>Sair</span>
            </button>
          </div>
        </aside>

        {open && <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-h-screen lg:ml-0">
          <Outlet />
        </main>
      </div>
      <WhatsAppNotifier />
    </div>
  );
}
