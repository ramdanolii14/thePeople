import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

function isHlsSource(src) {
  return typeof src === 'string' && /\.m3u8(?:$|\?)/i.test(src);
}

export default function HlsVideoPlayer({ src, className = '' }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let hls = null;
    let active = true;
    setLevels([]);
    setCurrentLevel(-1);
    setAspectRatio(16 / 9);

    const updateAspectRatio = () => {
      if (!active || !video.videoWidth || !video.videoHeight) return;
      const ratio = video.videoWidth / video.videoHeight;
      if (Number.isFinite(ratio) && ratio > 0) setAspectRatio(ratio);
    };

    video.addEventListener('loadedmetadata', updateAspectRatio);
    video.addEventListener('resize', updateAspectRatio);

    if (!src) {
      video.removeAttribute('src');
      video.load();
      return () => {
        active = false;
        video.removeEventListener('loadedmetadata', updateAspectRatio);
        video.removeEventListener('resize', updateAspectRatio);
      };
    }

    if (isHlsSource(src) && Hls.isSupported()) {
      hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (active) setLevels(data.levels || []);
      });
    } else {
      // Native HLS browsers and regular MP4/WebM sources use the browser player.
      video.src = src;
      video.load();
    }

    return () => {
      active = false;
      video.pause();
      video.removeEventListener('loadedmetadata', updateAspectRatio);
      video.removeEventListener('resize', updateAspectRatio);
      if (hls) hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
      video.removeAttribute('src');
      video.load();
    };
  }, [src]);

  const handleQualityChange = (index) => {
    setCurrentLevel(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    }
  };

  const responsiveFrameStyle = {
    '--player-aspect-ratio': String(aspectRatio),
    '--player-mobile-width': (aspectRatio * 55) + 'vh',
    '--player-desktop-width': (aspectRatio * 80) + 'vh'
  };

  return (
    <div
      className="media-player-frame relative mx-auto flex shrink-0 items-center justify-center overflow-hidden bg-black"
      style={responsiveFrameStyle}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        className={'h-full w-full object-contain ' + className}
      />

      {levels.length > 0 && (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-sm sm:right-3 sm:top-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white">Resolusi</span>
          <select
            value={currentLevel}
            onChange={(event) => handleQualityChange(Number(event.target.value))}
            aria-label="Pilih kualitas video"
            className="cursor-pointer rounded border border-white/30 bg-black/90 px-2 py-1 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <option value={-1}>Auto</option>
            {levels.map((level, index) => (
              <option key={index} value={index}>
                {level.height ? level.height + 'p' : 'Tingkat ' + (index + 1)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
