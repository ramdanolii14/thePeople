import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';
import PostModal from '../components/PostModal';
import PostThumbnail from '../components/PostThumbnail';

export default function IndexPage() {
  const { currentUser } = useAuth();
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    let active = true;

    const loadIndexData = async () => {
      setLoading(true);
      setError('');
      try {
        const postsRes = await fetch(API_BASE_URL + '/posts');
        if (!postsRes.ok) {
          throw new Error('Postingan gagal dimuat. Pastikan server backend berjalan.');
        }

        const postsData = await postsRes.json();
        if (active) setRecentPosts(Array.isArray(postsData) ? postsData.slice(0, 4) : []);
      } catch (err) {
        if (active) setError(err.message || 'Postingan gagal dimuat.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadIndexData();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-8">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <header className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Beranda</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Postingan terbaru dari komunitas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/feed"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Lihat feed
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            to={currentUser ? '/add-post' : '/auth'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-3.5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Buat postingan
          </Link>
        </div>
      </header>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Postingan terbaru</h2>
            {!loading && (
              <p className="mt-1 text-xs text-gray-500">
                {recentPosts.length} postingan ditampilkan
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-500">
            Memuat postingan...
          </div>
        ) : recentPosts.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-14 text-center">
            <p className="text-sm font-medium text-gray-800">Belum ada postingan.</p>
            <p className="mt-1.5 text-sm text-gray-500">
              Postingan yang dibagikan akan muncul di sini.
            </p>
            <Link
              to={currentUser ? '/add-post' : '/auth'}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat postingan pertama
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {recentPosts.map((post) => (
              <button
                type="button"
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="aspect-square w-full overflow-hidden bg-gray-100">
                  <PostThumbnail
                    post={post}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="flex w-full flex-1 flex-col p-3.5">
                  <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">
                    {post.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                    {post.description}
                  </p>
                  <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-gray-100 pt-3">
                    <GoogleAvatar
                      name={post.author_name || post.full_name}
                      src={post.profile_photo_url}
                      size="sm"
                    />
                    <span className="min-w-0 truncate text-xs font-medium text-gray-600">
                      {post.author_name || post.full_name}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}
