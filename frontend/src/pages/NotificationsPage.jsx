import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Heart, MessageCircle, CheckCheck, RefreshCw, ArrowUpRight } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import GoogleAvatar from '../components/GoogleAvatar';

function formatNotificationDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function notificationText(notification) {
  if (notification.type === 'like') return 'menyukai postingan Anda';
  if (notification.type === 'comment') return 'mengomentari postingan Anda';
  return 'berinteraksi dengan postingan Anda';
}

export default function NotificationsPage() {
  const { currentUser, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadNotifications = useCallback(async (silent = false) => {
    if (!currentUser || !token) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const response = await fetch(API_BASE_URL + '/notifications', {
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Notifikasi gagal dimuat.');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      if (!silent) showToast(error.message || 'Notifikasi gagal dimuat.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentUser, token, showToast]);

  useEffect(() => {
    loadNotifications();
    if (!currentUser || !token) return undefined;

    const intervalId = window.setInterval(() => loadNotifications(true), 30000);
    return () => window.clearInterval(intervalId);
  }, [loadNotifications, currentUser, token]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  const markAllAsRead = async () => {
    if (!unreadCount || updating) return;
    setUpdating(true);
    try {
      const response = await fetch(API_BASE_URL + '/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Notifikasi gagal diperbarui.');
      const now = new Date().toISOString();
      setNotifications((previous) => previous.map((item) => (
        item.read_at ? item : { ...item, read_at: now }
      )));
      window.dispatchEvent(new Event('notifications:refresh'));
      showToast('Semua notifikasi sudah ditandai dibaca.', 'success');
    } catch (error) {
      showToast(error.message || 'Notifikasi gagal diperbarui.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const openNotification = async (notification) => {
    if (!notification.read_at) {
      try {
        const response = await fetch(API_BASE_URL + '/notifications/' + notification.id + '/read', {
          method: 'PATCH',
          headers: { Authorization: 'Bearer ' + token }
        });
        if (response.ok) {
          const data = await response.json();
          setNotifications((previous) => previous.map((item) => (
            item.id === notification.id ? { ...item, read_at: data.read_at } : item
          )));
          window.dispatchEvent(new Event('notifications:refresh'));
        }
      } catch {
        // Navigation still works if marking read fails temporarily.
      }
    }

    if (notification.post_id) {
      navigate('/feed?post=' + encodeURIComponent(notification.post_id));
    }
  };

  if (!currentUser) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-8 text-center">
        <Bell className="mx-auto h-6 w-6 text-gray-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Masuk untuk melihat notifikasi</h1>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <header className="flex flex-col justify-between gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Notifikasi</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unreadCount > 0 ? unreadCount + ' belum dibaca' : 'Semua sudah dibaca'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadNotifications()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} aria-hidden="true" />
            Muat ulang
          </button>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={!unreadCount || updating}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            Tandai dibaca
          </button>
        </div>
      </header>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
          <RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin text-gray-400" aria-hidden="true" />
          Memuat notifikasi
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-14 text-center">
          <Bell className="mx-auto h-7 w-7 text-gray-300" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-gray-800">Belum ada notifikasi</p>
          <p className="mt-1 text-sm text-gray-500">Like dan komentar baru pada postingan Anda akan tampil di sini.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
          {notifications.map((notification) => {
            const Icon = notification.type === 'like' ? Heart : MessageCircle;
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className={'flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-gray-50 ' + (
                  notification.read_at ? 'bg-white' : 'bg-blue-50/60'
                )}
              >
                <GoogleAvatar
                  name={notification.actor_name}
                  src={notification.actor_photo}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-5 text-gray-800">
                    <strong className="font-semibold">{notification.actor_name}</strong>{' '}
                    {notificationText(notification)}
                  </span>
                  {notification.post_title && (
                    <span className="mt-1 block truncate text-sm text-gray-600">
                      {notification.post_title}
                    </span>
                  )}
                  <span className="mt-1.5 block text-xs text-gray-400">
                    {formatNotificationDate(notification.created_at)}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-1">
                  <Icon className={'h-4 w-4 ' + (notification.type === 'like' ? 'text-rose-600' : 'text-blue-600')} aria-hidden="true" />
                  {!notification.read_at && <span className="h-2 w-2 rounded-full bg-blue-600" aria-label="Belum dibaca" />}
                  <ArrowUpRight className="h-4 w-4 text-gray-300" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-400">Menampilkan maksimal 50 notifikasi terbaru. Notifikasi like dari orang yang sama untuk satu postingan hanya dikirim sekali, sementara notifikasi komentar dibatasi satu kali per 10 menit per postingan dan pengirim.</p>
    </section>
  );
}
