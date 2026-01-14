import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  BarChart3,
  TrendingUp,
  CreditCard,
  LogOut,
  User,
} from "lucide-react";
import Logo from "../assets/logo.png";

/* ----------------------------- helpers (API) ------------------------------ */
async function apiFetch(path, options = {}) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error("Missing VITE_API_URL in frontend .env");

  const token = localStorage.getItem("token");

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export default function DashboardLayout() {
  const navigate = useNavigate();

  const navItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    { name: "Budget", path: "/budget", icon: <Wallet className="w-5 h-5" /> },
    {
      name: "Savings",
      path: "/savings",
      icon: <PiggyBank className="w-5 h-5" />,
    },
    {
      name: "Investment",
      path: "/investment",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      name: "Expenses",
      path: "/expenses",
      icon: <BarChart3 className="w-5 h-5" />,
    },
    { name: "Debt", path: "/debt", icon: <CreditCard className="w-5 h-5" /> },
  ];

  const [session, setSession] = useState({
    loading: true,
    user: null,
  });

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const res = await apiFetch("/api/auth/me");
        setSession({ loading: false, user: res.user || null });
      } catch {
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
      }
    };

    checkSession();
  }, [navigate]);

  if (session.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f5f8ff] via-[#e9f1ff] to-[#dbe8ff] font-inter">
        <div className="bg-white/90 border border-gray-200 shadow-sm rounded-2xl px-6 py-5 text-sm text-gray-700">
          Checking session...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f5f8ff] via-[#e9f1ff] to-[#dbe8ff] font-inter">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <nav className="w-full px-6 md:px-12 py-4 flex items-center justify-between">
          {/* ---- LEFT: LOGO + TEXT ---- */}
          <div className="flex items-center gap-3">
            <img
              src={Logo}
              alt="FinTrack logo"
              className="h-12 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
            />
            <span className="text-xl font-extrabold tracking-wide text-[#0b1222]">
              FinTrack<span className="text-sky-500">-Analysis</span>
            </span>
          </div>

          {/* ---- RIGHT: NAV ITEMS (DESKTOP) + USER + LOGOUT ---- */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm font-medium transition px-3 py-2 rounded-lg 
                  ${
                    isActive
                      ? "text-sky-600 bg-sky-100"
                      : "text-gray-600 hover:text-sky-500 hover:bg-gray-100"
                  }`
                }
              >
                {item.icon}
                {item.name}
              </NavLink>
            ))}

            {/* User + Logout */}
            <div className="ml-3 flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 border border-gray-200">
                <User className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">
                  {session.user?.fullName || session.user?.name || "User"}
                </span>
              </div>

              <button
                onClick={logout}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
                title="Logout"
                type="button"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden lg:inline">Logout</span>
              </button>
            </div>
          </div>
        </nav>

        {/* ---- MOBILE NAV ---- */}
        <div className="md:hidden flex items-center justify-between gap-3 px-4 pb-2">
          <div className="flex overflow-x-auto gap-4">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 
                  ${
                    isActive
                      ? "bg-sky-200 text-sky-700"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`
                }
              >
                {item.icon}
                {item.name}
              </NavLink>
            ))}
          </div>

          <button
            onClick={logout}
            className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition"
            title="Logout"
            type="button"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full px-6 md:px-12 py-10">
        <Outlet context={{ user: session.user }} />
      </main>
    </div>
  );
}
