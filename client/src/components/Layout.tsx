import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-card text-sm font-medium transition-colors ${
      isActive
        ? 'bg-accent text-white'
        : 'text-text-secondary hover:bg-slate-200/50'
    }`;

  return (
    <div className="min-h-screen bg-soft-gray">
      <header className="bg-midnight text-white shadow-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            🇧🇷 Brasil Match Tracker
          </h1>
          <nav className="flex gap-2">
            <NavLink to="/" className={navLinkClass}>
              Partidas
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Configurações
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}