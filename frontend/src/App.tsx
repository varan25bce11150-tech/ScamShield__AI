import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import LiveEvaluate from "./pages/LiveEvaluate";
import Audit from "./pages/Audit";
import Signals from "./pages/Signals";

const NAV = [
  { to: "/", label: "Live evaluation", end: true },
  { to: "/audit", label: "Audit activity", end: false },
  { to: "/signals", label: "Risk signals", end: false },
];

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="layout">
      <header className="mobile-topbar">
        <button
          aria-label="Open navigation"
          aria-expanded={navOpen}
          className="btn btn-ghost"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
        <span className="brand-mini">ScamShield AI</span>
      </header>

      <div
        className={`sidebar-backdrop ${navOpen ? "visible" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${navOpen ? "open" : ""}`} aria-label="Operations navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🛡</span>
          <div>
            <div className="brand-name">ScamShield AI</div>
            <div className="brand-sub">Payment safety operations</div>
          </div>
          <button className="btn btn-ghost sidebar-close" aria-label="Close navigation" onClick={() => setNavOpen(false)}>
            ✕
          </button>
        </div>
        <nav aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-foot">Decision support only — no payments are initiated.</p>
      </aside>

      <main className="workspace" id="workspace">
        <Routes>
          <Route path="/" element={<LiveEvaluate />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
