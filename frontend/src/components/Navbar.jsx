import { Link, NavLink } from "react-router-dom";
import Button from "./ui/Button.jsx";
import { Wallet } from "lucide-react";

export default function Navbar() {
  const navLinkClass = ({ isActive }) =>
    "px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 " +
    (isActive ? "bg-neutral-100 dark:bg-neutral-800" : "");

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Wallet className="h-6 w-6 text-brand" />
          <span>FinTrack Analysis</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" className={navLinkClass}>
            Home
          </NavLink>
          <NavLink to="/login" className={navLinkClass}>
            Login
          </NavLink>
          <NavLink to="/register" className={navLinkClass}>
            Register
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <Button as={Link} to="/login" className="hidden md:inline-flex">
            Sign in
          </Button>
          <Button
            as={Link}
            to="/register"
            className="bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Create account
          </Button>
        </div>
      </div>
    </header>
  );
}
