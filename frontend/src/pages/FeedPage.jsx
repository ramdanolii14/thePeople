// File: frontend/src/pages/FeedPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL, CATEGORIES } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';
import PostModal from '../components/PostModal';

export default function FeedPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);

  const fetchFeedPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'Semua') params.append('category', selectedCategory);
      if (searchQuery.trim() !== '') params.append('search', searchQuery.trim());

      const res = await fetch(`${API_BASE_URL}/posts?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat feed');
      setPosts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchFeedPosts();
  }, [fetchFeedPosts]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Filter Kiri */}
      <aside className="w-full lg:w-64 shrink-0 space-y-4">
        <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200 space-y-4">
          <h2 className="font-bold text-lg text-gray-900">Feed Marketplace</h2>

          <input
            type="text"
            placeholder="Cari judul, deskripsi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1877F2] focus:bg-white transition"
          />

          <Link
            to={currentUser ? '/add-post' : '/auth'}
            className="block text-center w-full bg-[#E7F3FF] hover:bg-blue-100 text-[#1877F2] font-semibold py-2.5 rounded-lg text-sm transition"
          >
            + Tambah Postingan Media
          </Link>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Kategori
            </p>
            <div className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedCategory === cat
                      ? 'bg-[#1877F2] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Grid Utama Marketplace */}
      <section className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-base">
            Menampilkan {posts.length} Postingan
          </h3>
          <button
            onClick={fetchFeedPosts}
            className="text-xs font-semibold text-[#1877F2] hover:underline"
          >
            Refresh Feed
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200 text-gray-500 text-sm">
            Memuat katalog dari server...
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200 space-y-2">
            <p className="text-gray-700 font-bold">Tidak ada postingan ditemukan.</p>
            <p className="text-xs text-gray-500">Coba ubah kata kunci atau buat postingan baru.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {posts.map((post) => {
              const isVideo = post.photo_url && post.photo_url.includes('.m3u8');
              
              // Prioritaskan thumbnail_url jika tersedia dan valid, jika tidak fallback ke photo_url
              const displayImage =
                post.thumbnail_url && post.thumbnail_url.trim() !== ''
                  ? post.thumbnail_url
                  : post.photo_url;

              return (
                <div
                  key={post.id}
                  className="bg-white rounded-xl overflow-hidden shadow-xs border border-gray-200 hover:shadow-md transition flex flex-col group"
                >
                  {/* Thumbnail / Gambar / Preview Video */}
                  <div
                    onClick={() => setSelectedPost(post)}
                    className="aspect-square bg-gray-100 relative overflow-hidden cursor-pointer flex items-center justify-center"
                  >
                    <img
                      src={displayImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        if (e.target.src !== post.photo_url) {
                          e.target.src = post.photo_url;
                        }
                      }}
                    />
                    <span className="absolute top-2.5 left-2.5 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                      {post.category || 'Umum'}
                    </span>
                    {isVideo && (
                      <span className="absolute bottom-2.5 right-2.5 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow">
                        VIDEO HLS
                      </span>
                    )}
                  </div>

                  {/* Detail Kartu */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div onClick={() => setSelectedPost(post)} className="cursor-pointer">
                      <h4 className="font-bold text-gray-900 text-base line-clamp-1 group-hover:text-[#1877F2]">
                        {post.title}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {post.description}
                      </p>
                    </div>

                    <div
                      onClick={() => navigate(`/user/${post.user_id}`)}
                      className="flex items-center gap-2.5 mt-3.5 pt-2.5 border-t border-gray-100 cursor-pointer hover:opacity-80"
                    >
                      <GoogleAvatar
                        name={post.author_name || post.full_name}
                        src={post.profile_photo_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {post.author_name || post.full_name}
                        </p>
                        <p className="text-[10px] text-gray-400">Lihat profil &rarr;</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Detail Postingan + Komentar & Like */}
      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}