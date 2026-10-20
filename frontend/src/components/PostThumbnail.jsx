import React, { useEffect, useMemo, useState } from 'react';
import { ImageOff, Play } from 'lucide-react';

function isHlsUrl(url) {
  return typeof url === 'string' && /\.m3u8(?:$|\?)/i.test(url);
}

function isVideoUrl(url) {
  return typeof url === 'string' && /\.(m3u8|mp4|mov|m4v|webm)(?:$|\?)/i.test(url);
}

function inferHlsThumbnail(url) {
  if (!url || typeof window === 'undefined') return '';
  try {
    const parsed = new URL(url, window.location.origin);
    const match = parsed.pathname.match(/\/uploads\/hls\/([^/]+)\/master\.m3u8$/i);
    return match ? parsed.origin + '/uploads/thumb_' + match[1] + '.jpg' : '';
  } catch {
    return '';
  }
}

export default function PostThumbnail({ post, className = 'h-full w-full object-cover' }) {
  const photoUrl = post?.photo_url || '';
  const isVideo = isHlsUrl(photoUrl) || /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(photoUrl);
  const candidates = useMemo(() => {
    const urls = [];
    const add = (value) => {
      if (typeof value === 'string' && value.trim() && !urls.includes(value.trim())) {
        urls.push(value.trim());
      }
    };
    if (!isVideoUrl(post?.thumbnail_url)) add(post?.thumbnail_url);
    add(inferHlsThumbnail(photoUrl));
    if (!isVideoUrl(photoUrl)) add(photoUrl);
    return urls;
  }, [post?.thumbnail_url, photoUrl]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => {
    setCandidateIndex(0);
  }, [post?.id, candidates.join('|')]);

  const hasImage = candidateIndex < candidates.length;
  if (!hasImage) {
    const FallbackIcon = isVideo ? Play : ImageOff;
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-100 px-3 text-gray-400">
        <FallbackIcon className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-center text-[11px]">
          {isVideo ? 'Pratinjau video tidak tersedia' : 'Gambar tidak tersedia'}
        </span>
      </div>
    );
  }

  return (
    <img
      key={candidates[candidateIndex]}
      src={candidates[candidateIndex]}
      alt={post?.title || 'Media postingan'}
      loading="lazy"
      className={className}
      onError={() => setCandidateIndex((current) => current + 1)}
    />
  );
}
