import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, ArrowUpRight } from 'lucide-react';
import { API_BASE_URL, CATEGORIES } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleAvatar from '../components/GoogleAvatar';
import PostModal from '../components/PostModal';
import PostThumbnail from '../components/PostThumbnail';

export default function FeedPage() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(API_BASE_URL + '/posts?' + params.toString());
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Feed gagal dimuat.');
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Feed gagal dimuat.');
      showToast(err.message || 'Feed gagal dimuat.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, showToast]);

  useEffect(() => {
    fetchFeedPosts();
  }, [fetchFeedPosts]);

  useEffect(() => {
    const requestedPostId = searchParams.get('post');
    if (!requestedPostId || posts.length === 0) return;

    const targetPost = posts.find((post) => String(post.id) === requestedPostId);
    if (!targetPost) return;

    setSelectedPost(targetPost);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('post');
    setSearchParams(nextParams, { replace: true });
  }, [posts, searchParams, setSearchParams]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-4 lg:w-64">
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Feed</h2>
            <p className="mt-1 text-sm text-gray-500">Temukan foto dan video dari komunitas.</p>
          </div>

          <input
            type="search"
            aria-label="Cari postingan"
            placeholder="Cari judul atau deskripsi"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />

          <Link
            to={currentUser ? '/add-post' : '/auth'}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tambah postingan
          </Link>

          <div className="border-t border-gray-100 pt-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Kategori</p>
            <div className="space-y-1">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ' + (
                    selectedCategory === category
                      ? 'bg-blue-50 text-[#1877F2]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Postingan terbaru</h3>
            <p className="mt-1 text-xs text-gray-500">{posts.length} postingan</p>
          </div>
          <button
            type="button"
            onClick={fetchFeedPosts}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} aria-hidden="true" />
            Perbarui
          </button>
        </div>

        {error && !loading && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-gray-400" aria-hidden="true" />
            Memuat postingan
          </div>
        ) : posts.length === 0 ? (
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-12 text-center">
            <h4 className="font-semibold text-gray-800">Belum ada postingan</h4>
            <p className="text-sm text-gray-500">Ubah pencarian atau jadilah yang pertama membagikan sesuatu.</p>
            <Link
              to={currentUser ? '/add-post' : '/auth'}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat postingan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {posts.map((post) => {
              const isVideo = Boolean(
                post.photo_url &&
                (post.photo_url.includes('.m3u8') || /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(post.photo_url))
              );
              return (
                <article
                  key={post.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPost(post)}
                    aria-label={'Buka postingan ' + (post.title || '')}
                    className="relative aspect-square w-full overflow-hidden bg-gray-100 text-left"
                  >
                    <PostThumbnail
                      post={post}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                    <span className="absolute left-3 top-3 rounded-md bg-black/65 px-2 py-1 text-[10px] font-medium text-white">
                      {post.category || 'Umum'}
                    </span>
                    {isVideo && (
                      <span className="absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                        Video
                      </span>
                    )}
                  </button>

                  <div className="flex flex-1 flex-col p-3.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPost(post)}
                      className="text-left"
                    >
                      <h4 className="line-clamp-1 text-sm font-semibold text-gray-900 transition group-hover:text-[#1877F2]">
                        {post.title}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                        {post.description}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate('/user/' + post.user_id)}
                      className="mt-3.5 flex items-center gap-2.5 border-t border-gray-100 pt-3 text-left transition hover:opacity-75"
                    >
                      <GoogleAvatar
                        name={post.author_name || post.full_name}
                        src={post.profile_photo_url}
                        size="sm"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">
                        {post.author_name || post.full_name}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}
