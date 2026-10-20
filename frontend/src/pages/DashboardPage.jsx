import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Camera, FileText, UserRound, Plus, Save, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleAvatar from '../components/GoogleAvatar';
import PostThumbnail from '../components/PostThumbnail';

export default function DashboardPage() {
  const { currentUser, setCurrentUser, token } = useAuth();
  const { showToast } = useToast();
  const [myPosts, setMyPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    profile_photo_url: '',
    bio: ''
  });

  useEffect(() => {
    if (!currentUser) return;
    setProfileForm({
      full_name: currentUser.full_name || '',
      profile_photo_url: currentUser.profile_photo_url || '',
      bio: currentUser.bio || ''
    });
  }, [currentUser]);

  const fetchMyPosts = useCallback(async () => {
    if (!currentUser) {
      setLoadingPosts(false);
      return;
    }

    setLoadingPosts(true);
    try {
      const res = await fetch(API_BASE_URL + '/posts?user_id=' + currentUser.id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Postingan gagal dimuat.');
      setMyPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Postingan gagal dimuat.', 'error');
    } finally {
      setLoadingPosts(false);
    }
  }, [currentUser, showToast]);

  useEffect(() => {
    fetchMyPosts();
  }, [fetchMyPosts]);

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const res = await fetch(API_BASE_URL + '/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(profileForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profil gagal diperbarui.');
      setCurrentUser(data.user);
      showToast('Profil berhasil diperbarui.', 'success');
    } catch (err) {
      showToast(err.message || 'Profil gagal diperbarui.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (deletingPostId !== null) return;
    setDeletingPostId(postId);
    try {
      const res = await fetch(API_BASE_URL + '/posts/' + postId, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Postingan gagal dihapus.');
      setMyPosts((previous) => previous.filter((post) => post.id !== postId));
      showToast('Postingan berhasil dihapus.', 'success');
    } catch (err) {
      showToast(err.message || 'Postingan gagal dihapus.', 'error');
    } finally {
      setDeletingPostId(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Masuk untuk membuka dashboard</h2>
        <p className="text-sm text-gray-500">Masuk ke akun untuk mengatur profil dan postingan.</p>
        <Link
          to="/auth"
          className="inline-flex items-center justify-center rounded-lg bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Masuk
        </Link>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Postingan saya',
      value: myPosts.length,
      Icon: FileText,
      detail: 'Postingan yang sudah dibuat'
    },
    {
      label: 'ID akun',
      value: '#' + currentUser.id,
      Icon: UserRound,
      detail: 'Identitas akun'
    },
    {
      label: 'Foto profil',
      value: currentUser.profile_photo_url ? 'Kustom' : 'Inisial',
      Icon: Camera,
      detail: currentUser.profile_photo_url ? 'Menggunakan foto pilihan' : 'Menggunakan avatar inisial'
    }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Akun</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Atur profil dan kelola postingan Anda.</p>
        </div>
        <Link
          to="/add-post"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Buat postingan
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {statCards.map(({ label, value, Icon, detail }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
              </div>
              <span className="rounded-lg bg-gray-100 p-2.5 text-gray-600">
                <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-400">{detail}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <GoogleAvatar
              name={profileForm.full_name}
              src={profileForm.profile_photo_url}
              size="lg"
            />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900">Profil saya</h2>
              <p className="truncate text-xs text-gray-500">{currentUser.email}</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium text-gray-700">Nama lengkap</label>
              <input
                id="profile-name"
                type="text"
                required
                value={profileForm.full_name}
                onChange={(event) => setProfileForm({ ...profileForm, full_name: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="profile-photo" className="mb-1.5 block text-sm font-medium text-gray-700">URL foto profil</label>
              <input
                id="profile-photo"
                type="url"
                placeholder="https://..."
                value={profileForm.profile_photo_url}
                onChange={(event) => setProfileForm({ ...profileForm, profile_photo_url: event.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => setProfileForm({ ...profileForm, profile_photo_url: '' })}
                className="mt-1.5 text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-800"
              >
                Gunakan avatar inisial
              </button>
            </div>

            <div>
              <label htmlFor="profile-bio" className="mb-1.5 block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                id="profile-bio"
                rows="3"
                value={profileForm.bio}
                onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })}
                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {savingProfile ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {savingProfile ? 'Menyimpan' : 'Simpan profil'}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Postingan saya</h2>
              <p className="mt-1 text-xs text-gray-500">{myPosts.length} postingan</p>
            </div>
            <Link to="/add-post" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Tambah
            </Link>
          </div>

          {loadingPosts ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Memuat postingan
            </div>
          ) : myPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-5 py-12 text-center">
              <FileText className="mx-auto h-6 w-6 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-gray-700">Belum ada postingan</p>
              <p className="mt-1 text-xs text-gray-500">Postingan yang Anda buat akan muncul di sini.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myPosts.map((post) => (
                <article key={post.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <PostThumbnail post={post} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-900">{post.title}</h3>
                    <p className="mt-1 line-clamp-1 text-xs text-gray-500">{post.description}</p>
                    <span className="mt-1.5 inline-block rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                      {post.category || 'Umum'}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Link
                      to={'/edit-post/' + post.id}
                      aria-label={'Edit ' + post.title}
                      className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 hover:text-[#1877F2]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      disabled={deletingPostId !== null}
                      aria-label={'Hapus ' + post.title}
                      className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-50"
                    >
                      {deletingPostId === post.id ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
