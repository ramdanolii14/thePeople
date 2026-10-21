import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  UsersRound,
  Home,
  Images,
  Plus,
  LayoutDashboard,
  UserRound,
  LogIn,
  LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from './GoogleAvatar';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Beranda', Icon: Home },
    { to: '/feed', label: 'Feed', Icon: Images },
    { to: '/add-post', label: 'Buat', Icon: Plus },
    { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    {
      to: currentUser ? '/user/' + currentUser.id : '/user',
      label: 'Profil',
      Icon: UserRound
    }
  ];

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1877F2] text-white">
            <UsersRound className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-lg font-semibold leading-tight tracking-tight text-gray-900">thePeople</span>
            <span className="block text-[11px] text-gray-500">Berbagi foto dan cerita</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigasi utama">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ' + (
                  isActive
                    ? 'bg-blue-50 text-[#1877F2]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {currentUser ? (
            <>
              <NotificationBell />
              <Link
                to={'/user/' + currentUser.id}
                className="flex items-center gap-2 rounded-full p-1.5 transition hover:bg-gray-50"
                aria-label="Buka profil"
              >
                <GoogleAvatar
                  name={currentUser.full_name}
                  src={currentUser.profile_photo_url}
                  size="sm"
                />
                <span className="hidden max-w-32 truncate text-sm font-medium text-gray-700 lg:inline">
                  {currentUser.full_name}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                Keluar
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Masuk
            </Link>
          )}
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-gray-100 bg-white px-2 py-1.5 md:hidden" aria-label="Navigasi mobile">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ' + (
                isActive ? 'bg-blue-50 text-[#1877F2]' : 'text-gray-600 hover:bg-gray-50'
              )
            }
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
