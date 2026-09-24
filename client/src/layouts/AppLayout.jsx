import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LanguageToggle } from '../context/LanguageContext.jsx';
import { Logo } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { homeFor } from '../utils/roles.js';
import { firstName, roleLabel } from '../utils/format.js';

const NAV = {
  GUEST: [
    { to: '/workshops', label: 'Workshops' },
    { to: '/verify', label: 'Verify a certificate' },
  ],
  PARTICIPANT: [
    { to: '/participant/dashboard', label: 'Dashboard' },
    { to: '/workshops', label: 'Workshops' },
    { to: '/participant/workshops', label: 'My Workshops' },
    { to: '/participant/certificates', label: 'Certificates' },
    { to: '/participant/profile', label: 'Profile' },
  ],
  ORGANIZER: [
    { to: '/organizer/dashboard', label: 'Dashboard' },
    { to: '/organizer/workshops', label: 'Workshops' },
    { to: '/workshops', label: 'Catalogue', end: true },
  ],
  ADMIN: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/workshops', label: 'Workshops' },
    { to: '/admin/organizers', label: 'Organizers' },
    { to: '/admin/participants', label: 'Participants' },
    { to: '/admin/certificates', label: 'Certificates' },
  ],
};

function NavItem({ to, label, end, onClick, large = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `relative inline-flex min-h-11 items-center gap-2 rounded-full px-3 font-medium tracking-[-0.02em] transition-colors ${
          large ? 'text-[28px]' : 'text-[16px]'
        } ${isActive ? 'text-ink' : 'text-charcoal/80 hover:text-ink'}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-signal-light" aria-hidden="true" />}
          {label}
        </>
      )}
    </NavLink>
  );
}

function NavBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const items = NAV[user?.role] || NAV.GUEST;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const signOut = () => {
    navigate('/', { replace: true });
    logout();
  };

  return (
    <div className="sticky top-0 z-40 px-4 pt-4 md:pt-6">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 rounded-full bg-white py-2 pl-4 pr-2 shadow-nav md:pl-6"
      >
        <Logo to={user ? homeFor(user) : '/'} />

        <ul className="nav-links hidden items-center gap-1 lg:flex">
          {items.map((item) => (
            <li key={item.to}>
              <NavItem {...item} />
            </li>
          ))}
        </ul>

        <div className="nav-account hidden items-center gap-2 lg:flex">
          <LanguageToggle />
          {user ? (
            <>
              <span className="nav-user px-2 text-right leading-tight">
                <span className="block text-[15px] font-medium" data-no-translate>{user.role === 'PARTICIPANT' ? firstName(user.name) : user.name}</span>
                <span className="block text-[12px] font-bold uppercase tracking-[0.06em] text-slate">
                  {roleLabel(user.role)}
                </span>
              </span>
              <button type="button" onClick={signOut} className="btn btn-secondary">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-quiet">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary">
                Create account
              </Link>
            </>
          )}
        </div>

        <div className="nav-mobile flex items-center gap-1 lg:hidden">
          <LanguageToggle />
          <button
            type="button"
            className="btn btn-secondary btn-icon border-transparent"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="fixed inset-0 z-50 overflow-y-auto bg-canvas px-4 pb-10 pt-4 lg:hidden">
          <div className="flex items-center justify-between rounded-full bg-white py-2 pl-4 pr-2 shadow-nav">
            <Logo to={user ? homeFor(user) : '/'} />
            <button
              type="button"
              className="btn btn-secondary btn-icon border-transparent"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>
          <ul className="mt-10 space-y-2 px-2">
            {items.map((item) => (
              <li key={item.to}>
                <NavItem {...item} large />
              </li>
            ))}
          </ul>
          <div className="mt-10 border-t rule px-2 pt-8">
            {user ? (
              <>
                <p className="font-medium" data-no-translate>{user.name}</p>
                <p className="text-slate" data-no-translate>{user.email}</p>
                <button type="button" onClick={signOut} className="btn btn-secondary mt-6 w-full">
                  <Icon name="logout" size={18} /> Sign out
                </button>
              </>
            ) : (
              <div className="grid gap-3">
                <Link to="/register" className="btn btn-primary btn-lg">
                  Create account
                </Link>
                <Link to="/login" className="btn btn-secondary btn-lg">
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Footer() {
  const { user } = useAuth();
  return (
    <footer className="mt-24 bg-ink px-4 pb-16 pt-16 text-white md:mt-32 md:pt-24">
      <div className="mx-auto max-w-[1280px]">
        <p className="max-w-2xl text-[32px] font-medium leading-[1.15] tracking-[-0.02em] md:text-[40px]">
          Learn it in the room. Prove it with a certificate anyone can verify.
        </p>
        <div className="mt-14 grid gap-10 sm:grid-cols-3">
          <div>
            <p className="mb-4 text-[13px] font-bold uppercase tracking-[0.06em] text-white/60">Explore</p>
            <ul className="space-y-3 text-[15px]">
              <li>
                <Link to="/workshops" className="hover:underline">
                  Workshop catalogue
                </Link>
              </li>
              <li>
                <Link to="/verify" className="hover:underline">
                  Verify a certificate
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[13px] font-bold uppercase tracking-[0.06em] text-white/60">Account</p>
            <ul className="space-y-3 text-[15px]">
              {user ? (
                <li>
                  <Link to={homeFor(user)} className="hover:underline">
                    My dashboard
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/login" className="hover:underline">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link to="/register" className="hover:underline">
                      Create an account
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
          <div>
            <p className="mb-4 text-[13px] font-bold uppercase tracking-[0.06em] text-white/60">About</p>
            <p className="text-[15px] text-white/80">
              CICT Workshop &amp; Learning Management Portal. Aurex&rsquo;26 · Track 01 · PS-01.
            </p>
          </div>
        </div>
        <p className="mt-14 border-t border-white/20 pt-6 text-[14px] text-white/60">
          © {new Date().getFullYear()} CICT. Built by Tech Comrades.
        </p>
      </div>
    </footer>
  );
}

export default function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-canvas"
      >
        Skip to content
      </a>
      <NavBar />
      <main id="main" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

// Standard page width + vertical rhythm for app pages.
export function Page({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-[1280px] px-4 pt-12 md:px-8 md:pt-20 ${className}`}>{children}</div>;
}
