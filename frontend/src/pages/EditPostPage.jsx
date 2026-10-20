// File: frontend/src/pages/EditPostPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL, CATEGORIES } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';

export default function EditPostPage() {
  const { id } = useParams();
  const { currentUser, token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    author_name: '',
    title: '',
    description: '',
    photo_url: '',
    category: 'Umum'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Ambil data post yang ingin diedit dari database saat halaman dimuat
  useEffect(() => {
    fetch(`${API_BASE_URL}/posts`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((posts) => {
        const found = posts.find((p) => Number(p.id) === Number(id));
        if (!found) {
          throw new Error('Postingan tidak ditemukan.');
        }

        // Pastikan hanya pemilik post yang bisa mengedit
        if (currentUser && Number(found.user_id) !== Number(currentUser.id)) {
          setError('Anda tidak memiliki izin untuk mengedit postingan ini.');
        }

        setForm({
          author_name: found.author_name || '',
          title: found.title || '',
          description: found.description || '',
          photo_url: found.photo_url || '',
          category: found.category || 'Umum'
        });
      })
      .catch((err) => setError(err.message || 'Gagal memuat data postingan'))
      .finally(() => setLoading(false));
  }, [id, currentUser]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, photo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE_URL}/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memperbarui postingan');

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl border border-gray-200 text-center space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">
          Login Diperlukan untuk Mengedit Postingan
        </h2>
        <Link
          to="/auth"
          className="inline-block bg-[#1877F2] text-white text-xs font-bold px-5 py-2.5 rounded-lg"
        >
          Login Sekarang
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white p-12 rounded-xl text-center border border-gray-200 text-sm text-gray-500">
        Memuat data postingan dari database...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-xs border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          Edit Postingan Foto
        </h2>
        <p className="text-xs text-gray-500 mb-6">
          Perbarui title, deskripsi, atau foto untuk Post ID #{id}.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Nama Orang (Pembuat)
            </label>
            <input
              type="text"
              required
              value={form.author_name}
              onChange={(e) => setForm({ ...form, author_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-gray-50"
              readOnly
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Title Foto
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Kategori
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white"
            >
              {CATEGORIES.filter((c) => c !== 'Semua').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase">
              URL Foto / Ganti File Gambar
            </label>
            <input
              type="text"
              required
              value={form.photo_url}
              onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
            <label className="inline-block cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg transition">
              Pilih File Baru dari Komputer
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Deskripsi Foto
            </label>
            <textarea
              rows="4"
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#1877F2] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </form>
      </div>

      <div className="md:col-span-2">
        <div className="sticky top-24 bg-white p-5 rounded-xl shadow-xs border border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Pratinjau Hasil Edit
          </p>
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
              {form.photo_url ? (
                <img
                  src={form.photo_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-400 px-4 text-center">
                  Foto tidak tersedia
                </span>
              )}
            </div>
            <div className="p-3.5">
              <h4 className="font-bold text-gray-900 text-base line-clamp-1">
                {form.title || 'Title Foto'}
              </h4>
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                {form.description || 'Deskripsi foto...'}
              </p>
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
                <GoogleAvatar
                  name={form.author_name}
                  src={currentUser.profile_photo_url}
                  size="sm"
                />
                <span className="text-xs font-semibold text-gray-800">
                  {form.author_name}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}