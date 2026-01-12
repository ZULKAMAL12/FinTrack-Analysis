import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import Logo from "../assets/logo.png"; // logo

export default function AppLayout() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  return (
    <div className="min-h-screen flex flex-col font-inter bg-gradient-to-b from-[#f5f8ff] via-[#e9f1ff] to-[#dbe8ff] text-[#0f172a]">
      {/* --- NAVBAR --- */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled
            ? "backdrop-blur-md bg-white/70 shadow-sm border-b border-gray-200"
            : "bg-transparent"
        }`}
      >
        <nav
          className={`max-w-7xl mx-auto flex justify-between items-center px-6 md:px-12 ${
            isAuthPage ? "py-3" : "py-4"
          }`}
        >
          {/* --- LOGO BLOCK (bars bigger) --- */}
          <NavLink
            to="/"
            className="flex items-center gap-3 hover:opacity-90 transition"
          >
            <img
              src={Logo}
              alt="FinTrack logo"
              className="h-14 w-auto object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
            />
            <span className="text-xl font-extrabold tracking-wide text-[#0b1222]">
              FinTrack<span className="text-sky-500">-Analysis</span>
            </span>
          </NavLink>

          {/* --- NAVIGATION (NOT FOR LOGIN / REGISTER) --- */}
          {!isAuthPage && (
            <div className="hidden md:flex items-center gap-8 text-sm font-medium">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `hover:text-sky-500 transition ${
                    isActive ? "text-sky-500" : "text-gray-700"
                  }`
                }
              >
                Home
              </NavLink>

              <a
                href="#features"
                className="hover:text-sky-500 text-gray-700 transition"
              >
                Features
              </a>

              <a
                href="#how-it-works"
                className="hover:text-sky-500 text-gray-700 transition"
              >
                How It Works
              </a>

              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `hover:text-sky-500 transition ${
                    isActive ? "text-sky-500" : "text-gray-700"
                  }`
                }
              >
                Login
              </NavLink>

              <NavLink
                to="/register"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-md hover:scale-[1.02] transition"
              >
                Get Started
              </NavLink>
            </div>
          )}

          {/* --- AUTH PAGES: BACK TO HOME BUTTON --- */}
          {isAuthPage && (
            <NavLink
              to="/"
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-sky-500 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </NavLink>
          )}
        </nav>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* FOOTER (hide on Login/Register) */}
      {!isAuthPage && (
        <footer className="mt-20 py-10 text-center text-sm text-gray-600 border-t border-gray-200 bg-white/30 backdrop-blur-md">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="font-semibold text-sky-500">
              FinTrack Analysis
            </span>{" "}
            • All rights reserved
          </p>
        </footer>
      )}
    </div>
  );
}
