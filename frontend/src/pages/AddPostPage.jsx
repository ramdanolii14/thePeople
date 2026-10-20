// File: frontend/src/pages/AddPostPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL, CATEGORIES } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';
import HlsVideoPlayer from '../components/HlsVideoPlayer';

export default function AddPostPage() {
  const { currentUser, token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    author_name: '',
    title: '',
    description: '',
    photo_url: '',
    thumbnail_url: '',
    category: 'Umum'
  });
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setForm((prev) => ({ ...prev, author_name: currentUser.full_name }));
    }
  }, [currentUser]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    if (file.type.startsWith('video/')) {
      setMediaType('video');
    } else {
      setMediaType('image');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let finalMediaUrl = form.photo_url;
      let finalThumbnailUrl = form.thumbnail_url;

      // Jika user memilih file fisik, unggah dulu ke backend /api/upload
      if (selectedFile) {
        const formData = new FormData();
        formData.append('media', selectedFile);

        const uploadRes = await fetch(`${API_BASE_URL}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.message || 'Gagal mengunggah file.');

        finalMediaUrl = uploadData.media_url;
        finalThumbnailUrl = uploadData.thumbnail_url || uploadData.media_url;
      }

      if (!finalMediaUrl) throw new Error('Harap pilih file media atau masukkan URL.');

      // Kirim data postingan lengkap ke database PostgreSQL
      const res = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          photo_url: finalMediaUrl,
          thumbnail_url: finalThumbnailUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan postingan.');

      navigate('/feed');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-xl border border-gray-200 text-center space-y-3">
        <h2 className="font-bold text-gray-900 text-lg">Login Diperlukan</h2>
        <Link to="/auth" className="inline-block bg-[#1877F2] text-white text-xs font-bold px-5 py-2.5 rounded-lg">
          Login Sekarang
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-xs border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Tambah Postingan Media</h2>
        <p className="text-xs text-gray-500 mb-6">Unggah gambar atau video panjang dengan konversi HLS otomatis.</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nama Orang</label>
            <input
              type="text"
              required
              value={form.author_name}
              onChange={(e) => setForm({ ...form, author_name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Title Media</label>
            <input
              type="text"
              required
              placeholder="Judul postingan..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Kategori</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white"
            >
              {CATEGORIES.filter((c) => c !== 'Semua').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase">Pilih File Media</label>
            <input
              type="file"
              accept="image/*,video/mp4,video/quicktime"
              onChange={handleFileChange}
              className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#1877F2] hover:file:bg-blue-100 cursor-pointer"
            />
            <p className="text-[11px] text-gray-400">Atau masukkan URL eksternal:</p>
            <input
              type="text"
              placeholder="https://..."
              value={form.photo_url}
              onChange={(e) => {
                setForm({ ...form, photo_url: e.target.value, thumbnail_url: e.target.value });
                setSelectedFile(null);
                setPreviewUrl(e.target.value);
              }}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Deskripsi</label>
            <textarea
              rows="4"
              required
              placeholder="Tulis deskripsi..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1877F2] hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm transition"
          >
            {submitting ? 'Memproses Video & Thumbnail...' : 'Publikasikan'}
          </button>
        </form>
      </div>

      <div className="md:col-span-2">
        <div className="sticky top-24 bg-white p-5 rounded-xl shadow-xs border border-gray-200">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Pratinjau</p>
          <div className="rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100 flex items-center justify-center">
            {previewUrl ? (
              mediaType === 'video' ? (
                <video src={previewUrl} controls className="w-full h-full object-cover" />
              ) : (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              )
            ) : (
              <span className="text-xs text-gray-400 text-center px-4">Pratinjau media muncul di sini</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}