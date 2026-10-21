import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { API_BASE_URL } from '../api/config';
import { useAuth } from '../context/AuthContext';

export default function NotificationBell() {
  const { currentUser, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!currentUser || !token) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetch(API_BASE_URL + '/notifications/unread-count', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (!response.ok) return;
      const data = await response.json();
      setUnreadCount(Math.max(0, Number(data.unread_count) || 0));
    } catch {
      // Keep the last known badge count when the network is unavailable.
    }
  }, [currentUser, token]);

  useEffect(() => {
    fetchUnreadCount();
    if (!currentUser || !token) return undefined;

    const intervalId = window.setInterval(fetchUnreadCount, 30000);
    window.addEventListener('notifications:refresh', fetchUnreadCount);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('notifications:refresh', fetchUnreadCount);
    };
  }, [fetchUnreadCount, currentUser, token]);

  if (!currentUser) return null;

  return (
    <Link
      to="/notifications"
      aria-label={unreadCount > 0 ? 'Notifikasi belum dibaca: ' + unreadCount : 'Notifikasi'}
      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
    >
      <Bell className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
