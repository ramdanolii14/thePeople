// File: frontend/src/components/PostModal.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from './GoogleAvatar';
import HlsVideoPlayer from './HlsVideoPlayer';

export default function PostModal({ post, onClose }) {
  const navigate = useNavigate();
  const { currentUser, token } = useAuth();

  const [likesCount, setLikesCount] = useState(post?.likes_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!post) return;
    fetch(`${API_BASE_URL}/posts/${post.id}/comments`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setComments(data))
      .catch((err) => console.error(err));
  }, [post]);

  if (!post) return null;

  const goToAuthorProfile = () => {
    onClose();
    navigate(`/user/${post.user_id}`);
  };

  const handleToggleLike = async () => {
    if (!currentUser) {
      alert('Silakan login terlebih dahulu.');
      navigate('/auth');
      return;
    }

    try {
      const method = isLiked ? 'DELETE' : 'POST';
      const res = await fetch(`${API_BASE_URL}/posts/${post.id}/like`, {
        method: method,
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setIsLiked(data.liked);
        setLikesCount(data.likes_count);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendComment = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert('Silakan login terlebih dahulu.');
      navigate('/auth');
      return;
    }
    if (!commentInput.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE_URL}/posts/${post.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ comment_text: commentInput })
      });
      const newComment = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, newComment]);
        setCommentInput('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const isVideo =
    (post.photo_url && post.photo_url.includes('.m3u8')) ||
    (post.photo_url && post.photo_url.match(/\.(mp4|mov|m4v|webm)$/i));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2 max-h-[90vh]"
      >
        <div className="bg-black flex items-center justify-center aspect-square md:aspect-auto md:h-full overflow-hidden">
          {isVideo ? (
            <HlsVideoPlayer src={post.photo_url} className="w-full h-full max-h-[80vh]" />
          ) : (
            <img src={post.photo_url} alt={post.title} className="w-full h-full object-contain" />
          )}
        </div>

        <div className="flex flex-col h-full max-h-[90vh] overflow-hidden bg-white">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div onClick={goToAuthorProfile} className="flex items-center gap-3 cursor-pointer">
              <GoogleAvatar name={post.author_name} src={post.profile_photo_url} size="md" />
              <div>
                <p className="font-bold text-sm text-gray-900">{post.author_name}</p>
                <p className="text-[11px] text-gray-400">{post.category || 'Umum'}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-lg px-2">
              X
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900">{post.title}</h3>
              <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{post.description}</p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleToggleLike}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  isLiked ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{isLiked ? 'Disukai' : 'Suka'}</span>
                <span>({likesCount})</span>
              </button>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase">Komentar ({comments.length})</p>
              {comments.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Belum ada komentar.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-2.5">
                    <GoogleAvatar name={comment.full_name} src={comment.profile_photo_url} size="sm" />
                    <div className="bg-gray-50 rounded-xl p-2.5 flex-1 text-xs">
                      <span className="font-bold text-gray-900 block">{comment.full_name}</span>
                      <p className="text-gray-700 mt-0.5">{comment.comment_text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleSendComment} className="p-3 border-t border-gray-100 flex gap-2 bg-white">
            <input
              type="text"
              placeholder={currentUser ? 'Tulis komentar...' : 'Login untuk berkomentar...'}
              value={commentInput}
              disabled={!currentUser}
              onChange={(e) => setCommentInput(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
            />
            <button
              type="submit"
              disabled={submittingComment || !currentUser}
              className="bg-[#1877F2] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg text-xs transition"
            >
              Kirim
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}