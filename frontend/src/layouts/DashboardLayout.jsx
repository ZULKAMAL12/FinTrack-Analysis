import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  BarChart3,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import Logo from "../assets/logo.png";

export default function DashboardLayout() {
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

          {/* ---- RIGHT: NAV ITEMS (DESKTOP) ---- */}
          <div className="hidden md:flex items-center gap-6">
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
          </div>
        </nav>

        {/* ---- MOBILE NAV ---- */}
        <div className="md:hidden flex overflow-x-auto px-4 pb-2 gap-4">
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
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 w-full px-6 md:px-12 py-10">
        <Outlet />
      </main>
    </div>
  );
}
