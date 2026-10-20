// File: frontend/src/components/HlsVideoPlayer.jsx
import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export default function HlsVideoPlayer({ src, className = '' }) {
  const videoRef = useRef(null);
  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 untuk Auto
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (src.endsWith('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setLevels(data.levels);
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    }
  }, [src]);

  const handleQualityChange = (index) => {
    setCurrentLevel(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index; // Mengganti kualitas secara instan tanpa reload
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center group">
      <video
        ref={videoRef}
        controls
        playsInline
        className={`w-full h-full object-contain ${className}`}
      />

      {/* Tombol Pemilihan Resolusi */}
      {levels.length > 0 && (
        <div className="absolute top-3 right-3 z-20 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/20">
          <span className="text-[10px] text-white font-bold uppercase tracking-wider">Resolusi:</span>
          <select
            value={currentLevel}
            onChange={(e) => handleQualityChange(Number(e.target.value))}
            className="bg-black/90 text-white text-xs font-semibold px-2 py-1 rounded border border-white/30 focus:outline-none cursor-pointer"
          >
            <option value={-1}>Auto (Adaptif)</option>
            {levels.map((lvl, idx) => (
              <option key={idx} value={idx}>
                {lvl.height ? `${lvl.height}p` : `Tingkat ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}