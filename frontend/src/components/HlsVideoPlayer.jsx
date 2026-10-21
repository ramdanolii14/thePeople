import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import Hls from 'hls.js';

function isHlsSource(src) {
  return typeof src === 'string' && /\.m3u8(?:$|\?)/i.test(src);
}

export default function HlsVideoPlayer({ src, className = '' }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const pendingQualitySwitchRef = useRef(null);
  const switchTimeoutRef = useRef(null);

  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    let hls = null;
    let active = true;

    if (switchTimeoutRef.current) {
      window.clearTimeout(switchTimeoutRef.current);
      switchTimeoutRef.current = null;
    }
    pendingQualitySwitchRef.current = null;
    setLevels([]);
    setCurrentLevel(-1);
    setAspectRatio(16 / 9);
    setIsSwitching(false);
    setSwitchError('');

    const updateAspectRatio = () => {
      if (!active || !video.videoWidth || !video.videoHeight) return;
      const ratio = video.videoWidth / video.videoHeight;
      if (Number.isFinite(ratio) && ratio > 0) setAspectRatio(ratio);
    };

    const resumeIfNeeded = (pending) => {
      if (!active || !pending?.wasPlaying || video.ended) return;
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          if (active) setSwitchError('Resolusi siap. Tekan putar untuk melanjutkan video.');
        });
      }
    };

    const finishQualitySwitch = (pending, message = '') => {
      if (!pendingQualitySwitchRef.current || pendingQualitySwitchRef.current !== pending) return;

      pendingQualitySwitchRef.current = null;
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = null;
      }

      if (active) {
        setIsSwitching(false);
        setSwitchError(message);
      }
      resumeIfNeeded(pending);
    };

    const handleFragmentBuffered = (_event, data) => {
      const pending = pendingQualitySwitchRef.current;
      if (!active || !pending) return;

      const bufferedLevel = Number(data?.frag?.level);
      // For a manual selection, wait until a fragment from that exact level
      // is buffered. Auto mode can resume after its next buffered fragment.
      if (pending.index !== -1 && bufferedLevel !== pending.index) return;
      finishQualitySwitch(pending);
    };

    const handleHlsError = (_event, data) => {
      const pending = pendingQualitySwitchRef.current;
      if (!active || !pending || !data?.fatal) return;

      // Do not leave the player paused with a permanent loading indicator.
      pendingQualitySwitchRef.current = null;
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = null;
      }
      if (hls) hls.currentLevel = pending.previousSelection;
      setCurrentLevel(pending.previousSelection);
      setIsSwitching(false);
      setSwitchError('Resolusi baru gagal dimuat. Kualitas sebelumnya dipulihkan.');
      resumeIfNeeded(pending);
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
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (active) setLevels(data.levels || []);
      });
      hls.on(Hls.Events.FRAG_BUFFERED, handleFragmentBuffered);
      hls.on(Hls.Events.ERROR, handleHlsError);
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      // Native HLS browsers and regular MP4/WebM sources use the browser player.
      video.src = src;
      video.load();
    }

    return () => {
      active = false;
      if (switchTimeoutRef.current) {
        window.clearTimeout(switchTimeoutRef.current);
        switchTimeoutRef.current = null;
      }
      pendingQualitySwitchRef.current = null;
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
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!hls || !video || isSwitching || index === currentLevel) return;

    const pending = {
      index,
      previousSelection: currentLevel,
      wasPlaying: !video.paused && !video.ended,
      playbackTime: video.currentTime
    };

    // Pause before changing levels so playback does not continue against an
    // emptied buffer. Resume only after a fragment of the requested quality
    // has been buffered.
    video.pause();
    pendingQualitySwitchRef.current = pending;
    setCurrentLevel(index);
    setIsSwitching(true);
    setSwitchError('');

    if (switchTimeoutRef.current) window.clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = window.setTimeout(() => {
      if (pendingQualitySwitchRef.current !== pending) return;

      pendingQualitySwitchRef.current = null;
      switchTimeoutRef.current = null;
      hls.currentLevel = pending.previousSelection;
      setCurrentLevel(pending.previousSelection);
      setIsSwitching(false);
      setSwitchError('Resolusi terlalu lama dimuat. Kualitas sebelumnya dipulihkan.');
      resumeFallback(pending, video);
    }, 15000);

    hls.currentLevel = index;
  };

  const resumeFallback = (pending, video) => {
    if (!pending.wasPlaying || video.ended) return;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        setSwitchError('Tekan putar untuk melanjutkan video.');
      });
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
        controls={!isSwitching}
        playsInline
        preload="metadata"
        className={'h-full w-full object-contain ' + className}
      />

      {isSwitching && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/35"
        >
          <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-black/75 px-3 py-2 text-sm font-medium text-white shadow-lg">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Mengganti resolusi
          </div>
        </div>
      )}

      {!isSwitching && switchError && (
        <div
          role="status"
          className="pointer-events-none absolute bottom-14 left-3 right-3 z-10 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-lg border border-amber-200/30 bg-black/80 px-3 py-2 text-center text-xs text-white"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {switchError}
        </div>
      )}

      {levels.length > 0 && (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2 py-1 backdrop-blur-sm sm:right-3 sm:top-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white">Resolusi</span>
          <select
            value={currentLevel}
            disabled={isSwitching}
            onChange={(event) => handleQualityChange(Number(event.target.value))}
            aria-label="Pilih kualitas video"
            className="cursor-pointer rounded border border-white/30 bg-black/90 px-2 py-1 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-wait disabled:opacity-60"
          >
            <option value={-1}>Auto</option>
            {levels.map((level, index) => {
              const shorterEdge = Math.min(Number(level.width) || 0, Number(level.height) || 0);
              const label = level.name || (shorterEdge >= 2160
                ? '4K (2160p)'
                : shorterEdge > 0
                  ? shorterEdge + 'p'
                  : 'Tingkat ' + (index + 1));
              return (
                <option key={index} value={index}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
      )}
    </div>
  );
}
