import { Routes, Route } from "react-router-dom";

// Layouts
import AppLayout from "./layouts/AppLayout.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";

// Public Pages
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";

// Dashboard Pages
import Dashboard from "./pages/Dashboard.jsx";
import Expenses from "./pages/Expenses.jsx";
import Budget from "./pages/Budget.jsx";
import SavingsPage from "./pages/Savings.jsx";
import Investment from "./pages/Investment.jsx";
import DebtsPage from "./pages/Debts.jsx";

export default function App() {
  return (
    <Routes>
      {/* ===================== PUBLIC AREA ===================== */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* ===================== DASHBOARD AREA ===================== */}
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/savings" element={<SavingsPage />} />
        <Route path="/investment" element={<Investment />} />
        <Route path="/debt" element={<DebtsPage />} />
      </Route>
    </Routes>
  );
}
