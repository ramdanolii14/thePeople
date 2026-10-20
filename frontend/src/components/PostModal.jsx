import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Send, X } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleAvatar from './GoogleAvatar';
import HlsVideoPlayer from './HlsVideoPlayer';

export default function PostModal({ post, onClose }) {
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();
  const { showToast } = useToast();

  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [loadingLike, setLoadingLike] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!post) return undefined;

    let active = true;
    setLikesCount(Number(post.likes_count) || 0);
    setIsLiked(false);
    setComments([]);
    setCommentInput('');

    const headers = token ? { Authorization: 'Bearer ' + token } : {};

    fetch(API_BASE_URL + '/posts/' + post.id + '/comments')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Komentar gagal dimuat.');
        return data;
      })
      .then((data) => {
        if (active) setComments(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) showToast(err.message || 'Komentar gagal dimuat.', 'error');
      });

    fetch(API_BASE_URL + '/posts/' + post.id + '/likes', { headers })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Status like gagal dimuat.');
        return data;
      })
      .then((data) => {
        if (!active) return;
        setLikesCount(Number(data.likes_count) || 0);
        setIsLiked(Boolean(data.liked));
      })
      .catch((err) => {
        if (active) showToast(err.message || 'Status like gagal dimuat.', 'error');
      });

    return () => {
      active = false;
    };
  }, [post?.id, token, showToast]);

  if (!post) return null;

  const goToAuthorProfile = () => {
    onClose();
    navigate('/user/' + post.user_id);
  };

  const handleToggleLike = async () => {
    if (!currentUser) {
      showToast('Silakan masuk untuk menyukai postingan.', 'info');
      onClose();
      navigate('/auth');
      return;
    }

    if (loadingLike) return;
    setLoadingLike(true);
    try {
      const res = await fetch(API_BASE_URL + '/posts/' + post.id + '/like', {
        method: isLiked ? 'DELETE' : 'POST',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Like gagal diperbarui.');
      setIsLiked(Boolean(data.liked));
      setLikesCount(Number(data.likes_count) || 0);
      showToast(data.liked ? 'Like ditambahkan.' : 'Like dihapus.', 'success');
    } catch (err) {
      showToast(err.message || 'Like gagal diperbarui.', 'error');
    } finally {
      setLoadingLike(false);
    }
  };

  const handleSendComment = async (event) => {
    event.preventDefault();
    const text = commentInput.trim();

    if (!currentUser) {
      showToast('Silakan masuk untuk berkomentar.', 'info');
      onClose();
      navigate('/auth');
      return;
    }
    if (!text || submittingComment) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(API_BASE_URL + '/posts/' + post.id + '/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ comment_text: text })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Komentar gagal dikirim.');
      setComments((previous) => [...previous, data]);
      setCommentInput('');
      showToast('Komentar berhasil dikirim.', 'success');
    } catch (err) {
      showToast(err.message || 'Komentar gagal dikirim.', 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const isVideo =
    (post.photo_url && post.photo_url.includes('.m3u8')) ||
    (post.photo_url && /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(post.photo_url));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="grid max-h-[90vh] w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-2"
      >
        <div className="flex aspect-square items-center justify-center overflow-hidden bg-black md:aspect-auto md:h-full">
          {isVideo ? (
            <HlsVideoPlayer src={post.photo_url} className="h-full max-h-[80vh] w-full" />
          ) : (
            <img src={post.photo_url} alt={post.title} className="h-full w-full object-contain" />
          )}
        </div>

        <div className="flex max-h-[90vh] flex-col overflow-hidden bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <button
              type="button"
              onClick={goToAuthorProfile}
              className="flex min-w-0 items-center gap-3 text-left"
            >
              <GoogleAvatar name={post.author_name || post.full_name} src={post.profile_photo_url} size="md" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">
                  {post.author_name || post.full_name}
                </span>
                <span className="block text-[11px] text-gray-400">{post.category || 'Umum'}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup postingan"
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{post.title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">{post.description}</p>
            </div>

            <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={loadingLike}
                aria-pressed={isLiked}
                className={'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ' + (
                  isLiked
                    ? 'bg-rose-50 text-rose-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                <Heart className="h-4 w-4" fill={isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                <span>{isLiked ? 'Disukai' : 'Suka'}</span>
                <span>{likesCount}</span>
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {comments.length} komentar
              </span>
            </div>

            <section className="space-y-3 border-t border-gray-100 pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Komentar</h4>
              {comments.length === 0 ? (
                <p className="py-3 text-sm text-gray-400">Belum ada komentar.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <GoogleAvatar name={comment.full_name} src={comment.profile_photo_url} size="sm" />
                    <div className="min-w-0 flex-1 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                      <p className="font-semibold text-gray-900">{comment.full_name}</p>
                      <p className="mt-0.5 whitespace-pre-line break-words text-gray-700">{comment.comment_text}</p>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>

          <form onSubmit={handleSendComment} className="flex gap-2 border-t border-gray-100 bg-white p-3">
            <input
              type="text"
              placeholder={currentUser ? 'Tulis komentar...' : 'Masuk untuk berkomentar'}
              value={commentInput}
              disabled={!currentUser || submittingComment}
              onChange={(event) => setCommentInput(event.target.value)}
              className="min-w-0 flex-1 rounded-lg bg-gray-100 px-3 py-2.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2] disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={submittingComment || !currentUser || !commentInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1877F2] px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
