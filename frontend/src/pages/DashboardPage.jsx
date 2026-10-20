// File: frontend/src/pages/DashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';

export default function DashboardPage() {
  const { currentUser, setCurrentUser, token } = useAuth();
  const [myPosts, setMyPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    profile_photo_url: '',
    bio: ''
  });

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        full_name: currentUser.full_name || '',
        profile_photo_url: currentUser.profile_photo_url || '',
        bio: currentUser.bio || ''
      });
    }
  }, [currentUser]);

  const fetchMyPosts = useCallback(async () => {
    if (!currentUser) return;
    setLoadingPosts(true);
    try {
      const res = await fetch(`${API_BASE_URL}/posts?user_id=${currentUser.id}`);
      const data = await res.json();
      if (res.ok) setMyPosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPosts(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memperbarui profil');

      setCurrentUser(data.user);
      setMessage('Profil berhasil diperbarui di database PostgreSQL!');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePost = async (postId) => {
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${postId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal menghapus postingan');
      }
      setMyPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      setError(err.message);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl border border-gray-200 text-center space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">
          Silakan Login untuk Membuka Dashboard
        </h2>
        <Link
          to="/auth"
          className="inline-block bg-[#1877F2] text-white text-xs font-bold px-5 py-2.5 rounded-lg"
        >
          Ke Halaman Login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase">
            Total Postingan Saya
          </p>
          <p className="text-3xl font-extrabold text-[#1877F2] mt-1">
            {myPosts.length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase">
            ID Pengguna Database
          </p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">
            #{currentUser.id}
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">
              Status Foto Profil
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-1">
              {currentUser.profile_photo_url
                ? 'Foto Kustom Aktif'
                : 'Google Initials Avatar Aktif'}
            </p>
          </div>
          <GoogleAvatar
            name={currentUser.full_name}
            src={currentUser.profile_photo_url}
            size="md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 h-fit">
          <h3 className="font-bold text-base text-gray-900 mb-1">
            Pengaturan Profil & Avatar
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Kosongkan URL Foto Profil untuk otomatis memakai placeholder <strong>Google Initials Avatar</strong>.
          </p>

          <div className="flex items-center gap-4 mb-5 p-3 bg-gray-50 rounded-xl">
            <GoogleAvatar
              name={profileForm.full_name}
              src={profileForm.profile_photo_url}
              size="lg"
            />
            <div>
              <p className="font-bold text-sm text-gray-900">
                {profileForm.full_name}
              </p>
              <p className="text-xs text-gray-500">{currentUser.email}</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={profileForm.full_name}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, full_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                URL Foto Profil
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Kosongkan untuk pakai Google Avatar"
                  value={profileForm.profile_photo_url}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      profile_photo_url: e.target.value
                    })
                  }
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    setProfileForm({ ...profileForm, profile_photo_url: '' })
                  }
                  className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded-lg"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                rows="2"
                value={profileForm.bio}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, bio: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#1877F2] hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm transition"
            >
              Simpan Perubahan
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-gray-900">
              Kelola Postingan Foto Saya ({myPosts.length})
            </h3>
            <Link
              to="/add-post"
              className="text-xs bg-[#1877F2] text-white font-semibold px-3 py-1.5 rounded-lg"
            >
              + Tambah Post Baru
            </Link>
          </div>

          {loadingPosts ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Memuat postingan Anda...
            </div>
          ) : myPosts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm border border-dashed border-gray-200 rounded-xl">
              Anda belum memposting foto apa pun.
            </div>
          ) : (
            <div className="space-y-3">
              {myPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={post.photo_url}
                      alt={post.title}
                      className="w-16 h-16 rounded-lg object-cover shrink-0 bg-gray-100"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 truncate">
                        {post.title}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {post.description}
                      </p>
                      <span className="inline-block mt-1 text-[10px] bg-blue-50 text-[#1877F2] font-semibold px-2 py-0.5 rounded">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to={`/edit-post/${post.id}`}
                      className="text-xs font-semibold text-[#1877F2] hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      className="text-xs font-semibold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}