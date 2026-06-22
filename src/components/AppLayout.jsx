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
} from "@phosphor-icons/react";

const ICONS = { House, ClipboardText, ListChecks, PlusCircle, FileText, Users, Truck, Stack, UserGear, Devices };

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
    <div className="min-h-screen bg-[#F5F7FA] text-[#0F1411] font-[Manrope,sans-serif]">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 bg-[#0F2542] text-white flex items-center justify-between px-4 py-3">
        <button onClick={() => setOpen(!open)} data-testid="mobile-menu-btn" className="p-2 -ml-2 text-white">
          {open ? <X size={22} /> : <List size={22} />}
        </button>
        <div className="flex items-center gap-2">
          <Drop size={22} weight="fill" className="text-[#3B82F6]" />
          <span className="font-[Outfit,sans-serif] font-black tracking-tight">MACRO AMBIENTAL</span>
        </div>
        <button onClick={handleLogout} data-testid="mobile-logout" className="p-2 -mr-2 text-white"><SignOut size={20} /></button>
      </header>

      <div className="flex">
        {/* Sidebar - DARK NAVY */}
        <aside
          className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-gradient-to-b from-[#0F2542] to-[#16294A] text-white flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          {/* Logo */}
          <div className="px-6 py-7 border-b border-white/10">
            <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
              <div className="w-10 h-10 rounded-md bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center">
                <Drop size={22} weight="fill" className="text-white" />
              </div>
              <div>
                <div className="font-[Outfit,sans-serif] font-black text-lg leading-none tracking-tight">MACRO</div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-bold mt-1">Ambiental</div>
              </div>
            </Link>
          </div>

          {/* Profile */}
          <div className="px-5 py-4 border-b border-white/10 bg-white/5">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 font-bold">Perfil</div>
            <div className="text-sm font-bold text-white mt-0.5" data-testid="profile-role">
              {ROLE_LABELS[profile?.role] || "—"}
            </div>
            <div className="text-xs text-white/70 mt-0.5 truncate">{profile?.name || profile?.email}</div>
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
                  className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-200 ${active ? "bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white shadow-lg shadow-blue-900/30" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} weight={active ? "fill" : "regular"} />
                  <span>{item.label}</span>
                  {active && <span className="absolute right-0 top-0 bottom-0 w-1 bg-white rounded-l-md" />}
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
