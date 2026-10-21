import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Camera, FileText, UserRound, Plus, Save, LoaderCircle, Pencil, Trash2, ImagePlus, Upload, X, Link2 } from 'lucide-react';
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
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarInputRef = useRef(null);
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

  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!acceptedTypes.includes(file.type)) {
      showToast('Pilih gambar JPG, PNG, WEBP, atau GIF.', 'error');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Ukuran foto profil maksimal 10 MB.', 'error');
      event.target.value = '';
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setProfileForm((previous) => ({ ...previous, profile_photo_url: '' }));
  };

  const handleUseInitials = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setProfileForm((previous) => ({ ...previous, profile_photo_url: '' }));
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleProfilePhotoUrlChange = (event) => {
    setAvatarFile(null);
    setAvatarPreview('');
    setProfileForm((previous) => ({
      ...previous,
      profile_photo_url: event.target.value
    }));
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

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
      let profilePhotoUrl = profileForm.profile_photo_url;

      if (avatarFile) {
        const uploadForm = new FormData();
        uploadForm.append('media', avatarFile);

        const uploadRes = await fetch(API_BASE_URL + '/upload', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: uploadForm
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.message || 'Foto profil gagal diunggah.');
        }
        if (uploadData.media_type !== 'image' || !uploadData.media_url) {
          throw new Error('Server tidak mengembalikan file gambar yang valid.');
        }
        profilePhotoUrl = uploadData.media_url;
      }

      const updatedForm = {
        ...profileForm,
        profile_photo_url: profilePhotoUrl || ''
      };
      const res = await fetch(API_BASE_URL + '/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify(updatedForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Profil gagal diperbarui.');

      setCurrentUser(data.user);
      setProfileForm({
        full_name: data.user.full_name || '',
        profile_photo_url: data.user.profile_photo_url || '',
        bio: data.user.bio || ''
      });
      setAvatarFile(null);
      setAvatarPreview('');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      showToast(avatarFile ? 'Profil dan foto avatar berhasil disimpan.' : 'Profil berhasil diperbarui.', 'success');
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
              src={avatarPreview || profileForm.profile_photo_url}
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
              <label className="mb-2 block text-sm font-medium text-gray-700">Foto profil</label>
              <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <GoogleAvatar
                  name={profileForm.full_name}
                  src={avatarPreview || profileForm.profile_photo_url}
                  size="xl"
                  className="border-2 border-white shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {avatarFile ? avatarFile.name : (profileForm.profile_photo_url ? 'Foto profil kustom' : 'Avatar inisial')}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">JPG, PNG, WEBP, atau GIF. Maksimal 10 MB.</p>
                  <input
                    ref={avatarInputRef}
                    id="profile-avatar-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarFileChange}
                    disabled={savingProfile}
                    className="sr-only"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label
                      htmlFor="profile-avatar-file"
                      className={'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 ' + (savingProfile ? 'pointer-events-none opacity-50' : '')}
                    >
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                      {avatarFile || profileForm.profile_photo_url ? 'Ganti foto' : 'Unggah foto'}
                    </label>
                    {(avatarFile || profileForm.profile_photo_url) && (
                      <button
                        type="button"
                        onClick={handleUseInitials}
                        disabled={savingProfile}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-gray-500 transition hover:bg-white hover:text-gray-800 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Hapus foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800">
                  Atau gunakan URL gambar
                </summary>
                <div className="relative mt-2">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="profile-photo-url"
                    type="url"
                    placeholder="https://..."
                    value={profileForm.profile_photo_url}
                    onChange={handleProfilePhotoUrlChange}
                    disabled={savingProfile}
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                  />
                </div>
              </details>
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
