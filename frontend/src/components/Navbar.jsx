// File: frontend/src/components/Navbar.jsx
import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from './GoogleAvatar';

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Index' },
    { to: '/feed', label: 'Feed Marketplace' },
    { to: '/add-post', label: '+ Tambah Post' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: currentUser ? `/user/${currentUser.id}` : '/user', label: 'Halaman User' }
  ];

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-xs border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#1877F2] flex items-center justify-center text-white font-bold text-xl">
            P
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight text-gray-900 block leading-none">
              PhotoMarket
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold">
              Multi-Page + Supabase PostgreSQL
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-[#1877F2]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <Link
                to={`/user/${currentUser.id}`}
                className="flex items-center gap-2 hover:bg-gray-100 p-1.5 pr-3 rounded-full transition"
              >
                <GoogleAvatar
                  name={currentUser.full_name}
                  src={currentUser.profile_photo_url}
                  size="sm"
                />
                <span className="text-sm font-semibold text-gray-700 hidden sm:inline">
                  {currentUser.full_name}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="text-xs font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200"
              >
                Keluar
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="bg-[#1877F2] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              Login / Register
            </Link>
          )}
        </div>
      </div>

      <div className="flex md:hidden overflow-x-auto border-t border-gray-100 px-2 py-1.5 bg-white gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                isActive ? 'bg-[#1877F2] text-white' : 'text-gray-600 bg-gray-50'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}