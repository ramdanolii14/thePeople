// File: frontend/src/pages/AuthPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';

export default function AuthPage() {
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    profile_photo_url: '',
    bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegisterMode ? '/auth/register' : '/auth/login';
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Autentikasi gagal');

      loginSuccess(data.token, data.user);
      navigate('/feed');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xs border border-gray-200 my-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-extrabold text-gray-900">
          {isRegisterMode ? 'Registrasi Akun Baru' : 'Login ke PhotoMarket'}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {isRegisterMode
            ? 'Jika URL foto profil dikosongkan, akun otomatis memakai Google Initials Avatar.'
            : 'Masuk menggunakan akun yang terdaftar di PostgreSQL.'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-xs mb-4">
          {error}
        </div>
      )}

      {isRegisterMode && (
        <div className="flex flex-col items-center mb-5 p-3 bg-gray-50 rounded-xl">
          <GoogleAvatar
            name={form.full_name}
            src={form.profile_photo_url}
            size="lg"
          />
          <span className="text-[11px] text-gray-500 mt-2">
            Pratinjau Avatar Profil
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isRegisterMode && (
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              required
              placeholder="Masukkan nama lengkap"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Email
          </label>
          <input
            type="email"
            required
            placeholder="nama@email.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Password
          </label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
          />
        </div>

        {isRegisterMode && (
          <>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                URL Foto Profil (Opsional)
              </label>
              <input
                type="text"
                placeholder="Biarkan kosong untuk Google Initials Avatar"
                value={form.profile_photo_url}
                onChange={(e) =>
                  setForm({ ...form, profile_photo_url: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Bio Singkat (Opsional)
              </label>
              <input
                type="text"
                placeholder="Ceritakan sedikit tentang Anda"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1877F2] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition"
        >
          {loading
            ? 'Memproses...'
            : isRegisterMode
            ? 'Daftar Sekarang'
            : 'Masuk'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-gray-100 text-center">
        <button
          onClick={() => {
            setIsRegisterMode(!isRegisterMode);
            setError('');
          }}
          className="text-xs font-semibold text-[#1877F2] hover:underline"
        >
          {isRegisterMode
            ? 'Sudah punya akun? Login di sini'
            : 'Belum punya akun? Register akun baru'}
        </button>
      </div>
    </div>
  );
}