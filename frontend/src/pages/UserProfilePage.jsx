// File: frontend/src/pages/UserProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import GoogleAvatar from '../components/GoogleAvatar';
import PostModal from '../components/PostModal';
import PostThumbnail from '../components/PostThumbnail';

export default function UserProfilePage() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [allUsers, setAllUsers] = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/users`)
      .then((res) => (res.ok ? res.json() : []))
      .then((usersList) => {
        setAllUsers(usersList);
        const targetId = id || currentUser?.id || usersList[0]?.id;
        if (targetId) {
          fetch(`${API_BASE_URL}/users/${targetId}`)
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((detail) => {
              setProfileUser(detail.user);
              setUserPosts(detail.posts);
            })
            .catch(() => {
              setProfileUser(null);
              setUserPosts([]);
            })
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [id, currentUser]);

  return (
    <div className="space-y-6">
      {allUsers.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 mr-2">
            Daftar User di Database:
          </span>
          {allUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => navigate(`/user/${u.id}`)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                Number(profileUser?.id) === Number(u.id)
                  ? 'bg-[#1877F2] text-white border-[#1877F2]'
                  : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <GoogleAvatar
                name={u.full_name}
                src={u.profile_photo_url}
                size="sm"
                className="w-5 h-5 text-[10px]"
              />
              <span>{u.full_name}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-xl text-center border border-gray-200 text-sm text-gray-500">
          Memuat halaman profil user dari PostgreSQL...
        </div>
      ) : !profileUser ? (
        <div className="bg-white p-12 rounded-xl text-center border border-gray-200 space-y-2">
          <p className="font-bold text-gray-800">
            Data user belum tersedia di database.
          </p>
          <p className="text-xs text-gray-500">
            Silakan lakukan registrasi akun baru terlebih dahulu.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-200">
            <div className="h-28 bg-gradient-to-r from-[#1877F2] to-indigo-600" />
            <div className="px-6 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
                <GoogleAvatar
                  name={profileUser.full_name}
                  src={profileUser.profile_photo_url}
                  size="xl"
                  className="ring-4 ring-white shadow-md"
                />
                <div className="pt-2 sm:pt-0">
                  <h2 className="text-2xl font-extrabold text-gray-900">
                    {profileUser.full_name}
                  </h2>
                  <p className="text-xs text-gray-500">
                    User ID #{profileUser.id} &bull;{' '}
                    {profileUser.bio || 'Belum menulis bio.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-4">
              Katalog Postingan Foto oleh {profileUser.full_name} ({userPosts.length})
            </h3>
            {userPosts.length === 0 ? (
              <div className="bg-white p-8 rounded-xl text-center border border-gray-200 text-gray-500 text-sm">
                User ini belum mengunggah foto.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-xs hover:shadow-md transition cursor-pointer"
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      <PostThumbnail post={post} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3.5">
                      <h4 className="font-bold text-sm text-gray-900 line-clamp-1">
                        {post.title}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {post.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <PostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
}