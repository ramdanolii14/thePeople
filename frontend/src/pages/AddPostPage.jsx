import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle, UploadCloud, Image as ImageIcon, Link2 } from 'lucide-react';
import { API_BASE_URL, CATEGORIES } from '../api/config';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

function uploadWithProgress(formData, token, onProgress, onPhase) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', API_BASE_URL + '/upload');
    request.timeout = 60 * 60 * 1000;
    request.setRequestHeader('Authorization', 'Bearer ' + token);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    request.upload.addEventListener('load', () => {
      onPhase('processing');
      onProgress(0);
    });

    request.addEventListener('load', () => {
      let data;
      try {
        data = JSON.parse(request.responseText || '{}');
      } catch {
        reject(new Error('Server mengirim respons yang tidak dapat dibaca.'));
        return;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.message || 'Gagal mengunggah file.'));
      }
    });

    request.addEventListener('error', () => reject(new Error('Koneksi terputus saat mengunggah.')));
    request.addEventListener('abort', () => reject(new Error('Upload dibatalkan.')));
    request.addEventListener('timeout', () => reject(new Error('Upload melewati batas waktu. Coba unggah video yang lebih kecil atau periksa server.')));
    request.send(formData);
  });
}

async function pollVideoUpload(jobId, token, onProgress, onPhase) {
  const startedAt = Date.now();
  const maxWaitMs = 60 * 60 * 1000;

  while (Date.now() - startedAt < maxWaitMs) {
    const response = await fetch(
      API_BASE_URL + '/upload/' + encodeURIComponent(jobId) + '/status',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Status pemrosesan video tidak dapat diperiksa.');
    }

    onPhase(data.stage === 'thumbnail' ? 'thumbnail' : 'processing');
    if (Number.isFinite(Number(data.progress))) {
      onProgress(Math.max(0, Math.min(100, Number(data.progress))));
    }

    if (data.status === 'completed') {
      onProgress(100);
      return {
        ...data,
        media_type: 'video'
      };
    }

    if (data.status === 'failed') {
      throw new Error(data.message || 'Pemrosesan video gagal.');
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500));
  }

  throw new Error('Pemrosesan video terlalu lama. Periksa log backend sebelum mencoba kembali.');
}
export default function AddPostPage() {
  const { currentUser, token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    author_name: '',
    title: '',
    description: '',
    photo_url: '',
    thumbnail_url: '',
    category: 'Umum'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [previewUrl, setPreviewUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('uploading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setForm((previous) => ({ ...previous, author_name: currentUser.full_name || '' }));
    }
  }, [currentUser]);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showToast('Pilih file gambar atau video yang didukung.', 'error');
      event.target.value = '';
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMediaType(file.type.startsWith('video/') ? 'video' : 'image');
    setForm((previous) => ({ ...previous, photo_url: '', thumbnail_url: '' }));
    setUploadProgress(0);
    setUploadPhase('uploading');
    setError('');
  };

  const handleExternalUrlChange = (event) => {
    const value = event.target.value;
    setForm((previous) => ({
      ...previous,
      photo_url: value,
      thumbnail_url: value
    }));
    setSelectedFile(null);
    setPreviewUrl(value);
    setMediaType(/\.(mp4|mov|m4v|webm|m3u8)(?:$|\?)/i.test(value) ? 'video' : 'image');
    setUploadProgress(0);
    setUploadPhase('uploading');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setUploadProgress(0);
    setUploadPhase(selectedFile ? 'uploading' : 'saving');
    setError('');

    try {
      let finalMediaUrl = form.photo_url.trim();
      let finalThumbnailUrl = form.thumbnail_url.trim();

      if (selectedFile) {
        const formData = new FormData();
        formData.append('media', selectedFile);
        let uploadData = await uploadWithProgress(
          formData,
          token,
          setUploadProgress,
          setUploadPhase
        );

        if (uploadData.job_id) {
          uploadData = await pollVideoUpload(
            uploadData.job_id,
            token,
            setUploadProgress,
            setUploadPhase
          );
        }

        finalMediaUrl = uploadData.media_url;
        finalThumbnailUrl = uploadData.thumbnail_url || uploadData.media_url;
      }

      if (!finalMediaUrl) {
        throw new Error('Pilih file media atau masukkan URL terlebih dahulu.');
      }

      const res = await fetch(API_BASE_URL + '/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({
          ...form,
          photo_url: finalMediaUrl,
          thumbnail_url: finalThumbnailUrl
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Postingan gagal disimpan.');

      showToast('Postingan berhasil diunggah.', 'success');
      navigate('/feed');
    } catch (err) {
      const message = err.message || 'Postingan gagal diunggah.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Masuk untuk membuat postingan</h2>
        <Link to="/auth" className="inline-flex items-center justify-center rounded-lg bg-[#1877F2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
          Masuk
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-5">
      <section className="rounded-xl border border-gray-200 bg-white p-6 md:col-span-3">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Buat postingan</h2>
          <p className="mt-1 text-sm text-gray-500">Bagikan foto atau video kepada komunitas.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="author-name" className="mb-1.5 block text-sm font-medium text-gray-700">Nama</label>
            <input
              id="author-name"
              type="text"
              required
              value={form.author_name}
              onChange={(event) => setForm({ ...form, author_name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="post-title" className="mb-1.5 block text-sm font-medium text-gray-700">Judul</label>
            <input
              id="post-title"
              type="text"
              required
              placeholder="Judul postingan"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="post-category" className="mb-1.5 block text-sm font-medium text-gray-700">Kategori</label>
            <select
              id="post-category"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {CATEGORIES.filter((category) => category !== 'Semua').map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2.5">
            <label htmlFor="media-file" className="block text-sm font-medium text-gray-700">Media</label>
            <label htmlFor="media-file" className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 transition hover:border-blue-300 hover:bg-blue-50/40">
              <UploadCloud className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-800">{selectedFile ? selectedFile.name : 'Pilih foto atau video'}</span>
                <span className="mt-0.5 block text-xs text-gray-500">Pilih file dari perangkat</span>
              </span>
              <span className="text-xs font-semibold text-[#1877F2]">Pilih file</span>
            </label>
            <input
              id="media-file"
              type="file"
              accept="image/*,video/mp4,video/quicktime,video/x-m4v"
              onChange={handleFileChange}
              className="sr-only"
            />

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              atau masukkan URL
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="url"
                placeholder="https://..."
                value={form.photo_url}
                onChange={handleExternalUrlChange}
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="post-description" className="mb-1.5 block text-sm font-medium text-gray-700">Deskripsi</label>
            <textarea
              id="post-description"
              rows="4"
              required
              placeholder="Ceritakan tentang postingan ini"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              className="w-full resize-y rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {submitting && selectedFile && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3.5">
              <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                <span>
                  {uploadPhase === 'thumbnail'
                    ? 'Menyiapkan pratinjau'
                    : uploadPhase === 'processing'
                      ? 'Memproses video'
                      : uploadPhase === 'saving'
                        ? 'Menyimpan postingan'
                        : 'Mengupload'}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={uploadPhase === 'processing' || uploadPhase === 'thumbnail' ? 'Kemajuan pemrosesan video' : 'Kemajuan upload'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
                className="h-1.5 overflow-hidden rounded-full bg-gray-200"
              >
                <div
                  className="h-full rounded-full bg-[#1877F2] transition-[width] duration-150"
                  style={{ width: uploadProgress + '%' }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1877F2] py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Mengupload
              </>
            ) : (
              <>
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                Publikasikan
              </>
            )}
          </button>
        </form>
      </section>

      <aside className="md:col-span-2">
        <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5">
          <p className="mb-3 text-sm font-semibold text-gray-700">Pratinjau</p>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {previewUrl ? (
              mediaType === 'video' ? (
                <video src={previewUrl} controls className="h-full w-full object-contain" />
              ) : (
                <img src={previewUrl} alt="Pratinjau postingan" className="h-full w-full object-contain" />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 px-5 text-center text-sm text-gray-400">
                <ImageIcon className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
                Foto atau video yang dipilih akan tampil di sini.
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
