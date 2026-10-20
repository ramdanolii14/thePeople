// File: frontend/src/pages/IndexPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';
import PostModal from '../components/PostModal';

export default function IndexPage() {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState({ total_users: 0, total_posts: 0 });
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    const loadIndexData = async () => {
      setLoading(true);
      setError('');
      try {
        const [statsRes, postsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/stats`),
          fetch(`${API_BASE_URL}/posts`)
        ]);

        if (!statsRes.ok || !postsRes.ok) {
          throw new Error('Gagal mengambil data dari server PostgreSQL');
        }

        const statsData = await statsRes.json();
        const postsData = await postsRes.json();

        setStats(statsData);
        setRecentPosts(postsData.slice(0, 4));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadIndexData();
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          Tidak dapat terhubung ke REST API ({error}). Pastikan server backend sudah dijalankan.
        </div>
      )}

      <div className="bg-gradient-to-r from-[#1877F2] to-indigo-700 rounded-2xl p-8 md:p-12 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="max-w-2xl space-y-4">
          <span className="inline-block bg-white/20 text-xs font-semibold px-3 py-1 rounded-full">
            Halaman Index &bull; PostgreSQL Database
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
            Posting Foto Seperti Facebook, Tersusun Rapi Seperti Marketplace.
          </h1>
          <p className="text-blue-100 text-sm md:text-base leading-relaxed">
            Setiap foto, judul, dan deskripsi yang kamu bagikan tersimpan langsung di PostgreSQL Supabase dan ditampilkan dalam tata letak grid katalog.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/feed"
              className="bg-white text-[#1877F2] hover:bg-blue-50 font-bold px-6 py-3 rounded-xl shadow-xs transition"
            >
              Jelajahi Feed Marketplace
            </Link>
            <Link
              to={currentUser ? '/add-post' : '/auth'}
              className="bg-blue-900/50 hover:bg-blue-900 text-white font-semibold px-6 py-3 rounded-xl border border-white/20 transition"
            >
              {currentUser ? '+ Tambah Postingan Foto' : 'Login / Register'}
            </Link>
          </div>
        </div>

        <div className="w-full md:w-72 bg-white/10 border border-white/20 rounded-2xl p-6 space-y-4">
          <p className="text-xs uppercase font-bold tracking-wider text-blue-100">
            Data Real-Time Database
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-4 rounded-xl">
              <p className="text-3xl font-extrabold">{stats.total_posts}</p>
              <p className="text-xs text-blue-100 mt-1">Total Foto</p>
            </div>
            <div className="bg-white/10 p-4 rounded-xl">
              <p className="text-3xl font-extrabold">{stats.total_users}</p>
              <p className="text-xs text-blue-100 mt-1">Total User</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Postingan Foto Terbaru
          </h2>
          <Link
            to="/feed"
            className="text-sm font-semibold text-[#1877F2] hover:underline"
          >
            Lihat Semua di Feed &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200 text-gray-500 text-sm">
            Memuat data dari PostgreSQL...
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200 space-y-3">
            <p className="text-gray-800 font-bold">
              Belum ada postingan di database.
            </p>
            <p className="text-gray-500 text-xs">
              Jadilah yang pertama mengunggah foto ke katalog Marketplace ini!
            </p>
            <Link
              to={currentUser ? '/add-post' : '/auth'}
              className="inline-block bg-[#1877F2] text-white text-xs font-bold px-5 py-2.5 rounded-lg"
            >
              {currentUser ? '+ Buat Postingan Pertama' : 'Login / Register'}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="bg-white rounded-xl overflow-hidden shadow-xs border border-gray-200 hover:shadow-md transition cursor-pointer flex flex-col"
              >
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  <img
                    src={post.photo_url}
                    alt={post.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm line-clamp-1">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                      {post.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
                    <GoogleAvatar
                      name={post.author_name}
                      src={post.profile_photo_url}
                      size="sm"
                    />
                    <span className="text-xs font-medium text-gray-700 truncate">
                      {post.author_name}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}