import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from './ui';

const links = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transfer', label: 'Transfer' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/kyc', label: 'Verification' },
];

export function Layout() {
  const { customer, logout } = useAuth();

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
              OB
            </span>
            <span className="text-sm font-bold tracking-tight">OUR Bank</span>
          </div>

          <nav className="hidden gap-1 sm:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                // NavLink gives us `isActive` so the current page is highlighted.
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 md:inline">
              {customer?.firstName} {customer?.lastName}
            </span>
            <Button variant="secondary" onClick={logout} className="px-3 py-1.5 text-xs">
              Sign out
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 sm:hidden">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Outlet renders whichever child route matched the URL. */}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
