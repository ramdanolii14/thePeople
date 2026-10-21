/**
 * File: backend/server.js (Multi-Resolution HLS + Auto Thumbnail + Comments + Likes)
 */

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'rahasia_jwt_supabase_2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const HLS_DIR = path.join(__dirname, 'uploads', 'hls');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

app.use('/uploads', express.static(UPLOAD_DIR));

const ALLOWED_MIME_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/x-m4v': '.m4v'
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = ALLOWED_MIME_TYPES[file.mimetype];
        cb(null, `${uuidv4()}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES[file.mimetype]) {
        return cb(new Error('Format file ditolak!'), false);
    }
    cb(null, true);
};

const upload = multer({ storage: storage, limits: { fileSize: 1000 * 1024 * 1024 }, fileFilter });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Token tidak valid.' });
        req.userId = decoded.id;
        next();
    });
};

// ============================================================================
// Upload media. Video diproses sebagai job agar request upload tidak menunggu
// konversi HLS selesai. Frontend mengambil status melalui endpoint status job.
// ============================================================================
const uploadJobs = new Map();
const JOB_RETENTION_MS = 60 * 60 * 1000;

function scheduleUploadJobCleanup(jobId) {
    const cleanupTimer = setTimeout(() => uploadJobs.delete(jobId), JOB_RETENTION_MS);
    if (cleanupTimer.unref) cleanupTimer.unref();
}

function removeFileIfExists(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
        console.warn('Gagal membersihkan file upload:', error.message);
    }
}

async function createVideoThumbnail(filePath, thumbnailFilename, thumbnailPath) {
    await new Promise((resolve) => {
        ffmpeg(filePath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: thumbnailFilename,
                folder: UPLOAD_DIR,
                size: '640x?'
            })
            .on('end', resolve)
            .on('error', (error) => {
                console.warn('Thumbnail video tidak berhasil dibuat:', error.message);
                resolve();
            });
    });

    return fs.existsSync(thumbnailPath);
}

function probeVideoDimensions(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (error, metadata) => {
            if (error) return reject(error);

            const videoStream = (metadata.streams || []).find((stream) => stream.codec_type === 'video');
            if (!videoStream || !Number(videoStream.width) || !Number(videoStream.height)) {
                return reject(new Error('Dimensi video tidak dapat dibaca.'));
            }

            let width = Number(videoStream.width);
            let height = Number(videoStream.height);
            const sideRotation = (videoStream.side_data_list || []).find(
                (item) => Number.isFinite(Number(item.rotation))
            )?.rotation;
            const rotation = Number(videoStream.tags?.rotate ?? sideRotation ?? 0);

            // FFmpeg otomatis merotasi video saat transcode, jadi samakan
            // dimensi target dengan orientasi tampilnya.
            if (Number.isFinite(rotation) && Math.abs(Math.round(rotation)) % 180 === 90) {
                [width, height] = [height, width];
            }

            resolve({ width, height });
        });
    });
}

function scaleVideoDimensions(sourceWidth, sourceHeight, maxWidth, maxHeight) {
    const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
    const width = Math.max(2, Math.floor((sourceWidth * scale) / 2) * 2);
    const height = Math.max(2, Math.floor((sourceHeight * scale) / 2) * 2);
    return { width, height };
}

function processVideoUpload(jobId) {
    const job = uploadJobs.get(jobId);
    if (!job) return;

    const { filePath, fileId, baseUrl, thumbnailFilename, thumbnailPath } = job;
    const outputFolder = path.join(HLS_DIR, fileId);
    const masterPlaylistPath = path.join(outputFolder, 'master.m3u8');

    job.stage = 'thumbnail';
    job.message = 'Menyiapkan pratinjau video.';
    job.progress = 2;

    (async () => {
        try {
            fs.mkdirSync(outputFolder, { recursive: true });

            const hasThumbnail = await createVideoThumbnail(filePath, thumbnailFilename, thumbnailPath);
            job.thumbnail_url = hasThumbnail ? baseUrl + '/uploads/' + thumbnailFilename : null;
            job.stage = 'conversion';
            job.message = 'Mengonversi video.';
            job.progress = 5;

            const sourceDimensions = await probeVideoDimensions(filePath);
            const isPortrait = sourceDimensions.height > sourceDimensions.width;

            const requestedResolutions = [
                { resolution: 144, videoBitrate: '160k', audioBitrate: '48k', bandwidth: 220000 },
                { resolution: 240, videoBitrate: '350k', audioBitrate: '64k', bandwidth: 450000 },
                { resolution: 360, videoBitrate: '700k', audioBitrate: '96k', bandwidth: 850000 },
                { resolution: 480, videoBitrate: '1400k', audioBitrate: '96k', bandwidth: 1600000 },
                { resolution: 720, videoBitrate: '2800k', audioBitrate: '128k', bandwidth: 3200000 },
                { resolution: 1080, videoBitrate: '5000k', audioBitrate: '192k', bandwidth: 5600000 },
                { resolution: 1440, videoBitrate: '9000k', audioBitrate: '192k', bandwidth: 10000000 },
                { resolution: 2160, videoBitrate: '18000k', audioBitrate: '256k', bandwidth: 20000000 }
            ];

            // Resolution "p" refers to the shorter video dimension. This supports
            // both landscape and portrait while excluding variants above source
            // resolution. A final scale cap also ensures FFmpeg never upscales.
            const sourceShortEdge = Math.min(sourceDimensions.width, sourceDimensions.height);
            const profiles = requestedResolutions
                .filter((profile) => sourceShortEdge >= profile.resolution)
                .map((profile) => {
                    const longEdge = Math.round(profile.resolution * 16 / 9);
                    return {
                        ...profile,
                        name: profile.resolution + 'p',
                        folder: path.join(outputFolder, profile.resolution + 'p'),
                        maxWidth: isPortrait ? profile.resolution : longEdge,
                        maxHeight: isPortrait ? longEdge : profile.resolution
                    };
                });

            if (profiles.length === 0) {
                throw new Error('Resolusi sumber terlalu rendah untuk membuat profil HLS minimal 144p.');
            }

            profiles.forEach((profile) => {
                const dimensions = scaleVideoDimensions(
                    sourceDimensions.width,
                    sourceDimensions.height,
                    profile.maxWidth,
                    profile.maxHeight
                );
                profile.width = dimensions.width;
                profile.height = dimensions.height;
                fs.mkdirSync(profile.folder, { recursive: true });
            });

            await new Promise((resolve, reject) => {
                const command = ffmpeg(filePath);

                profiles.forEach((profile) => {
                    command
                        .output(path.join(profile.folder, 'index.m3u8'))
                        .videoCodec('libx264')
                        .size(profile.width + 'x' + profile.height)
                        .autopad()
                        .videoBitrate(profile.videoBitrate)
                        .audioCodec('aac')
                        .audioBitrate(profile.audioBitrate)
                        .outputOptions(['-preset veryfast', '-hls_time 10', '-hls_list_size 0', '-f hls']);
                });

                const timeout = setTimeout(() => {
                    command.kill('SIGKILL');
                }, 45 * 60 * 1000);

                command
                    .on('progress', (progress) => {
                        const percent = Number(progress.percent);
                        if (Number.isFinite(percent)) {
                            job.progress = Math.max(5, Math.min(98, Math.round(5 + percent * 0.93)));
                        }
                    })
                    .on('end', () => {
                        clearTimeout(timeout);
                        resolve();
                    })
                    .on('error', (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    })
                    .run();
            });

            const masterLines = ['#EXTM3U', '#EXT-X-VERSION:3'];
            profiles.forEach((profile) => {
                masterLines.push(
                    '#EXT-X-STREAM-INF:BANDWIDTH=' + profile.bandwidth +
                    ',RESOLUTION=' + profile.width + 'x' + profile.height
                );
                masterLines.push(profile.name + '/index.m3u8');
            });
            masterLines.push('');
            const masterContent = masterLines.join('\n');
            fs.writeFileSync(masterPlaylistPath, masterContent, 'utf8');
            removeFileIfExists(filePath);

            job.status = 'completed';
            job.stage = 'completed';
            job.progress = 100;
            job.media_url = baseUrl + '/uploads/hls/' + fileId + '/master.m3u8';
            job.message = 'Video berhasil diproses.';
            scheduleUploadJobCleanup(jobId);
        } catch (error) {
            console.error('Error saat memproses video:', error);
            job.status = 'failed';
            job.stage = 'failed';
            job.message = 'Pemrosesan video gagal. Periksa format video dan konfigurasi FFmpeg di server.';
            job.error = error.message;
            removeFileIfExists(filePath);
            try {
                if (fs.existsSync(outputFolder)) fs.rmSync(outputFolder, { recursive: true, force: true });
            } catch (cleanupError) {
                console.warn('Gagal membersihkan hasil konversi:', cleanupError.message);
            }
            scheduleUploadJobCleanup(jobId);
        }
    })();
}

app.post('/api/upload', authenticateToken, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'File tidak diunggah atau ditolak.' });
        }

        const filePath = req.file.path;
        const fileMime = req.file.mimetype;
        const baseUrl = req.protocol + '://' + req.get('host');
        const fileId = path.basename(req.file.filename, path.extname(req.file.filename));

        if (fileMime.startsWith('video/')) {
            const jobId = uuidv4();
            const thumbnailFilename = 'thumb_' + fileId + '.jpg';
            const thumbnailPath = path.join(UPLOAD_DIR, thumbnailFilename);

            uploadJobs.set(jobId, {
                id: jobId,
                userId: req.userId,
                status: 'processing',
                stage: 'queued',
                progress: 0,
                message: 'Upload selesai. Menyiapkan pemrosesan video.',
                filePath,
                fileId,
                baseUrl,
                thumbnailFilename,
                thumbnailPath,
                media_url: baseUrl + '/uploads/hls/' + fileId + '/master.m3u8',
                thumbnail_url: null
            });

            setImmediate(() => processVideoUpload(jobId));

            return res.status(202).json({
                job_id: jobId,
                status: 'processing',
                progress: 0,
                message: 'Upload selesai. Video sedang diproses.'
            });
        }

        return res.json({
            message: 'Gambar berhasil diunggah',
            media_url: baseUrl + '/uploads/' + req.file.filename,
            thumbnail_url: baseUrl + '/uploads/' + req.file.filename,
            media_type: 'image'
        });
    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) removeFileIfExists(req.file.path);
        return res.status(500).json({ message: 'Gagal mengunggah file', error: error.message });
    }
});

app.get('/api/upload/:jobId/status', authenticateToken, (req, res) => {
    const job = uploadJobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({
            status: 'failed',
            message: 'Status upload tidak ditemukan. Silakan unggah ulang video.'
        });
    }
    if (Number(job.userId) !== Number(req.userId)) {
        return res.status(403).json({ message: 'Anda tidak memiliki akses ke status upload ini.' });
    }

    return res.json({
        job_id: job.id,
        status: job.status,
        stage: job.stage,
        progress: job.progress,
        message: job.message,
        media_url: job.status === 'completed' ? job.media_url : undefined,
        thumbnail_url: job.status === 'completed' ? job.thumbnail_url : undefined
    });
});

// Endpoint Statistik, Auth, Users, Posts, Likes, dan Comments tetap seperti sebelumnya...
app.get('/api/stats', async (req, res) => {
    try {
        const usersCount = await pool.query('SELECT COUNT(*)::int AS total_users FROM public.users');
        const postsCount = await pool.query('SELECT COUNT(*)::int AS total_posts FROM public.posts');
        res.json({ total_users: usersCount.rows[0].total_users, total_posts: postsCount.rows[0].total_posts });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil statistik', error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { full_name, email, password, profile_photo_url, bio } = req.body;
        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO public.users (full_name, email, password_hash, profile_photo_url, bio)
             VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, profile_photo_url, bio`,
            [full_name.trim(), email.trim().toLowerCase(), passwordHash, profile_photo_url || null, bio || null]
        );
        const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Registrasi gagal', error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM public.users WHERE LOWER(email) = LOWER($1)', [email]);
        if (result.rows.length === 0 || !(await bcrypt.compare(password, result.rows[0].password_hash))) {
            return res.status(401).json({ message: 'Email atau password salah.' });
        }
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, full_name: user.full_name, email: user.email, profile_photo_url: user.profile_photo_url, bio: user.bio } });
    } catch (error) {
        res.status(500).json({ message: 'Login gagal', error: error.message });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, full_name, email, profile_photo_url, bio FROM public.users WHERE id = $1', [req.userId]);
        res.json({ user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Gagal memuat sesi', error: error.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, full_name, email, profile_photo_url, bio FROM public.users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil user', error: error.message });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const userResult = await pool.query('SELECT id, full_name, email, profile_photo_url, bio FROM public.users WHERE id = $1', [req.params.id]);
        const postsResult = await pool.query('SELECT p.*, u.full_name, u.profile_photo_url FROM public.posts p JOIN public.users u ON p.user_id = u.id WHERE p.user_id = $1 ORDER BY p.created_at DESC', [req.params.id]);
        res.json({ user: userResult.rows[0], posts: postsResult.rows });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil profil', error: error.message });
    }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const { full_name, profile_photo_url, bio } = req.body;
        const result = await pool.query(
            `UPDATE public.users SET full_name = $1, profile_photo_url = $2, bio = $3 WHERE id = $4 RETURNING id, full_name, email, profile_photo_url, bio`,
            [full_name, profile_photo_url || null, bio || null, req.userId]
        );
        res.json({ message: 'Profil diperbarui', user: result.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Gagal update profil', error: error.message });
    }
});

// ============================================================================
// Notifications: persistent activity alerts with server-side deduplication.
// ============================================================================
let notificationsTableReady = null;

async function ensureNotificationsTable() {
    if (!notificationsTableReady) {
        notificationsTableReady = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS public.notifications (
                    id BIGSERIAL PRIMARY KEY,
                    recipient_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                    actor_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
                    post_id INTEGER REFERENCES public.posts(id) ON DELETE SET NULL,
                    type TEXT NOT NULL CHECK (type IN ('like', 'comment')),
                    dedupe_key TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    read_at TIMESTAMPTZ
                )
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
                ON public.notifications (recipient_user_id, created_at DESC)
            `);
            await pool.query(`
                CREATE INDEX IF NOT EXISTS notifications_unread_idx
                ON public.notifications (recipient_user_id, created_at DESC)
                WHERE read_at IS NULL
            `);
        })().catch((error) => {
            notificationsTableReady = null;
            throw error;
        });
    }
    return notificationsTableReady;
}

async function createActivityNotification({ recipientUserId, actorUserId, postId, type }) {
    if (!recipientUserId || !actorUserId || !postId ||
        String(recipientUserId) === String(actorUserId)) return;

    let client;
    try {
        await ensureNotificationsTable();
        client = await pool.connect();
        await client.query('BEGIN');

        // Serialize comment notification checks for the same actor/post so
        // concurrent comment requests cannot bypass the cooldown.
        const scopeKey = [recipientUserId, actorUserId, postId, type].join(':');
        if (type === 'comment') {
            await client.query(
                'SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',
                ['notification:' + scopeKey]
            );

            const recentNotification = await client.query(
                `SELECT 1
                 FROM public.notifications
                 WHERE recipient_user_id = $1
                   AND actor_user_id = $2
                   AND post_id = $3
                   AND type = 'comment'
                   AND created_at > NOW() - INTERVAL '10 minutes'
                 LIMIT 1`,
                [recipientUserId, actorUserId, postId]
            );
            if (recentNotification.rows.length > 0) {
                await client.query('COMMIT');
                return;
            }
        }

        // A like alerts only once per actor/post pair for the lifetime of that post.
        // The unique key also makes simultaneous repeated like requests idempotent.
        const bucket = type === 'comment' ? Math.floor(Date.now() / 600000) : 'once';
        const dedupeKey = [type, postId, recipientUserId, actorUserId, bucket].join(':');

        await client.query(
            `INSERT INTO public.notifications
                (recipient_user_id, actor_user_id, post_id, type, dedupe_key)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (dedupe_key) DO NOTHING`,
            [recipientUserId, actorUserId, postId, type, dedupeKey]
        );
        await client.query('COMMIT');
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Gagal membatalkan pembuatan notifikasi:', rollbackError.message);
            }
        }
        // A notification failure must not make the actual like/comment fail.
        console.error('Gagal membuat notifikasi aktivitas:', error.message);
    } finally {
        if (client) client.release();
    }
}

app.get('/api/notifications/unread-count', authenticateToken, async (req, res) => {
    try {
        await ensureNotificationsTable();
        const result = await pool.query(
            'SELECT COUNT(*)::int AS unread_count FROM public.notifications WHERE recipient_user_id = $1 AND read_at IS NULL',
            [req.userId]
        );
        res.json({ unread_count: result.rows[0].unread_count });
    } catch (error) {
        console.error('Gagal mengambil jumlah notifikasi:', error.message);
        res.status(500).json({ message: 'Notifikasi gagal dimuat.' });
    }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        await ensureNotificationsTable();
        const result = await pool.query(
            `SELECT n.id, n.type, n.post_id, n.created_at, n.read_at,
                    n.actor_user_id, u.full_name AS actor_name,
                    u.profile_photo_url AS actor_photo, p.title AS post_title
             FROM public.notifications n
             JOIN public.users u ON u.id = n.actor_user_id
             LEFT JOIN public.posts p ON p.id = n.post_id
             WHERE n.recipient_user_id = $1
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [req.userId]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Gagal mengambil notifikasi:', error.message);
        res.status(500).json({ message: 'Notifikasi gagal dimuat.' });
    }
});

app.patch('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await ensureNotificationsTable();
        const result = await pool.query(
            'UPDATE public.notifications SET read_at = NOW() WHERE recipient_user_id = $1 AND read_at IS NULL',
            [req.userId]
        );
        res.json({ updated_count: result.rowCount });
    } catch (error) {
        console.error('Gagal menandai notifikasi:', error.message);
        res.status(500).json({ message: 'Notifikasi gagal diperbarui.' });
    }
});

app.patch('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await ensureNotificationsTable();
        const result = await pool.query(
            'UPDATE public.notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND recipient_user_id = $2 RETURNING id, read_at',
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Notifikasi tidak ditemukan.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Gagal menandai notifikasi:', error.message);
        res.status(500).json({ message: 'Notifikasi gagal diperbarui.' });
    }
});

app.get('/api/posts', async (req, res) => {
    try {
        const { search, category, user_id } = req.query;
        let query = `
            SELECT p.*, u.full_name, u.profile_photo_url,
                   (SELECT COUNT(*)::int FROM public.post_likes pl WHERE pl.post_id = p.id) AS likes_count
            FROM public.posts p 
            JOIN public.users u ON p.user_id = u.id 
            WHERE 1=1
        `;
        let params = [];

        if (category && category !== 'Semua') {
            params.push(category);
            query += ` AND p.category = $${params.length}`;
        }
        if (user_id) {
            params.push(user_id);
            query += ` AND p.user_id = $${params.length}`;
        }
        if (search) {
            params.push(`%${search}%`);
            query += ` AND (p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
        }
        query += ' ORDER BY p.created_at DESC';

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil post', error: error.message });
    }
});

app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        const { author_name, title, description, photo_url, thumbnail_url, category } = req.body;
        const result = await pool.query(
            `INSERT INTO public.posts (user_id, author_name, title, description, photo_url, thumbnail_url, category) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [req.userId, author_name, title, description, photo_url, thumbnail_url || photo_url, category || 'Umum']
        );
        const fullPost = await pool.query('SELECT p.*, u.full_name, u.profile_photo_url FROM public.posts p JOIN public.users u ON p.user_id = u.id WHERE p.id = $1', [result.rows[0].id]);
        res.status(201).json(fullPost.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Gagal membuat post', error: error.message });
    }
});

app.get('/api/posts/:id/likes', async (req, res) => {
    try {
        const countRes = await pool.query(
            'SELECT COUNT(*)::int AS count FROM public.post_likes WHERE post_id = $1',
            [req.params.id]
        );

        let liked = false;
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const likeRes = await pool.query(
                    'SELECT EXISTS (SELECT 1 FROM public.post_likes WHERE post_id = $1 AND user_id = $2) AS liked',
                    [req.params.id, decoded.id]
                );
                liked = Boolean(likeRes.rows[0].liked);
            } catch {
                // Public visitors can still read the like count when their token is absent or expired.
            }
        }

        res.json({ likes_count: countRes.rows[0].count, liked });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil like', error: error.message });
    }
});

app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
    try {
        const postResult = await pool.query(
            'SELECT user_id FROM public.posts WHERE id = $1',
            [req.params.id]
        );
        if (postResult.rows.length === 0) {
            return res.status(404).json({ message: 'Postingan tidak ditemukan.' });
        }

        const insertedLike = await pool.query(
            'INSERT INTO public.post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id',
            [req.params.id, req.userId]
        );

        if (insertedLike.rows.length > 0) {
            await createActivityNotification({
                recipientUserId: postResult.rows[0].user_id,
                actorUserId: req.userId,
                postId: req.params.id,
                type: 'like'
            });
        }

        const countRes = await pool.query(
            'SELECT COUNT(*)::int AS count FROM public.post_likes WHERE post_id = $1',
            [req.params.id]
        );
        res.json({ liked: true, likes_count: countRes.rows[0].count });
    } catch (error) {
        res.status(500).json({ message: 'Gagal like', error: error.message });
    }
});

app.delete('/api/posts/:id/like', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM public.post_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, req.userId]);
        const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM public.post_likes WHERE post_id = $1', [req.params.id]);
        res.json({ liked: false, likes_count: countRes.rows[0].count });
    } catch (error) {
        res.status(500).json({ message: 'Gagal unlike', error: error.message });
    }
});

app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.id, c.comment_text, c.created_at, u.id AS user_id, u.full_name, u.profile_photo_url 
             FROM public.post_comments c JOIN public.users u ON c.user_id = u.id WHERE c.post_id = $1 ORDER BY c.created_at ASC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Gagal komentar', error: error.message });
    }
});

app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
    try {
        const { comment_text } = req.body;
        if (typeof comment_text !== 'string' || !comment_text.trim()) {
            return res.status(400).json({ message: 'Komentar tidak boleh kosong.' });
        }

        const postResult = await pool.query(
            'SELECT user_id FROM public.posts WHERE id = $1',
            [req.params.id]
        );
        if (postResult.rows.length === 0) {
            return res.status(404).json({ message: 'Postingan tidak ditemukan.' });
        }

        const insertRes = await pool.query(
            'INSERT INTO public.post_comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING id',
            [req.params.id, req.userId, comment_text.trim()]
        );
        const newComment = await pool.query(
            `SELECT c.id, c.comment_text, c.created_at, u.id AS user_id, u.full_name, u.profile_photo_url
             FROM public.post_comments c
             JOIN public.users u ON c.user_id = u.id
             WHERE c.id = $1`,
            [insertRes.rows[0].id]
        );

        await createActivityNotification({
            recipientUserId: postResult.rows[0].user_id,
            actorUserId: req.userId,
            postId: req.params.id,
            type: 'comment'
        });

        res.status(201).json(newComment.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Gagal kirim komentar', error: error.message });
    }
});

function getLocalUploadArtifact(mediaUrl, req) {
    if (typeof mediaUrl !== 'string' || !mediaUrl.trim()) return null;

    try {
        const requestOrigin = req.protocol + '://' + req.get('host');
        const requestUrl = new URL(requestOrigin);
        const parsed = new URL(mediaUrl, requestOrigin);

        const isLoopback = (hostname) =>
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '[::1]' ||
            hostname === '::1';

        const sameOrigin = parsed.origin === requestUrl.origin;
        const sameLocalHost = isLoopback(parsed.hostname) &&
            isLoopback(requestUrl.hostname) &&
            parsed.protocol === requestUrl.protocol &&
            parsed.port === requestUrl.port;

        // Never treat an arbitrary external URL as a local file.
        if (!sameOrigin && !sameLocalHost) return null;
        if (!parsed.pathname.startsWith('/uploads/')) return null;

        const encodedSegments = parsed.pathname.slice('/uploads/'.length).split('/');
        const segments = encodedSegments.map((segment) => decodeURIComponent(segment));

        if (segments.some((segment) =>
            !segment ||
            segment === '.' ||
            segment === '..' ||
            segment.includes('/') ||
            segment.includes('\\') ||
            segment.includes('\0')
        )) {
            return null;
        }

        if (
            segments.length === 3 &&
            segments[0] === 'hls' &&
            segments[2] === 'master.m3u8'
        ) {
            const artifactPath = path.resolve(HLS_DIR, segments[1]);
            const relativePath = path.relative(HLS_DIR, artifactPath);
            if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
                return null;
            }

            return {
                key: artifactPath,
                path: artifactPath,
                type: 'directory',
                sourceUrls: [mediaUrl]
            };
        }

        // Uploaded images, video originals, and thumbnails are stored directly
        // in uploads/. Do not delete arbitrary nested directories or HLS chunks.
        if (segments.length !== 1 || segments[0] === 'hls') return null;

        const artifactPath = path.resolve(UPLOAD_DIR, segments[0]);
        const relativePath = path.relative(UPLOAD_DIR, artifactPath);
        if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return null;
        }

        return {
            key: artifactPath,
            path: artifactPath,
            type: 'file',
            sourceUrls: [mediaUrl]
        };
    } catch {
        return null;
    }
}

function collectPostUploadArtifacts(post, req) {
    const artifactsByPath = new Map();

    [post.photo_url, post.thumbnail_url].forEach((mediaUrl) => {
        const artifact = getLocalUploadArtifact(mediaUrl, req);
        if (!artifact) return;

        const existing = artifactsByPath.get(artifact.key);
        if (existing) {
            if (!existing.sourceUrls.includes(mediaUrl)) existing.sourceUrls.push(mediaUrl);
            return;
        }
        artifactsByPath.set(artifact.key, artifact);
    });

    return [...artifactsByPath.values()];
}

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    let deletedPost = null;

    try {
        await client.query('BEGIN');

        const postResult = await client.query(
            'SELECT id, photo_url, thumbnail_url FROM public.posts WHERE id = $1 AND user_id = $2 FOR UPDATE',
            [req.params.id, req.userId]
        );

        if (postResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Postingan tidak ditemukan atau bukan milik Anda.' });
        }

        deletedPost = postResult.rows[0];

        await client.query(
            'DELETE FROM public.posts WHERE id = $1 AND user_id = $2',
            [req.params.id, req.userId]
        );

        await client.query('COMMIT');
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Gagal membatalkan penghapusan postingan:', rollbackError.message);
        }
        console.error('Gagal menghapus postingan:', error);
        return res.status(500).json({ message: 'Gagal menghapus postingan.' });
    } finally {
        client.release();
    }

    const artifacts = collectPostUploadArtifacts(deletedPost, req);
    const cleanupWarnings = [];

    for (const artifact of artifacts) {
        try {
            // The same URL may be shared by another post. Preserve its file
            // until no remaining post references that URL.
            const references = await pool.query(
                'SELECT 1 FROM public.posts WHERE photo_url = ANY($1::text[]) OR thumbnail_url = ANY($1::text[]) LIMIT 1',
                [artifact.sourceUrls]
            );
            if (references.rows.length > 0) continue;

            if (artifact.type === 'directory') {
                fs.rmSync(artifact.path, { recursive: true, force: true });
            } else if (fs.existsSync(artifact.path) && fs.statSync(artifact.path).isFile()) {
                fs.unlinkSync(artifact.path);
            }
        } catch (error) {
            cleanupWarnings.push(path.basename(artifact.path));
            console.error('Gagal membersihkan file media postingan:', artifact.path, error.message);
        }
    }

    if (cleanupWarnings.length > 0) {
        return res.json({
            message: 'Postingan dihapus, tetapi sebagian file media gagal dibersihkan.',
            cleanup_warnings: cleanupWarnings
        });
    }

    return res.json({ message: 'Postingan dan file media terkait berhasil dihapus.' });
});

app.listen(PORT, () => {
    console.log(`Server REST API lokal berjalan di http://localhost:${PORT}`);
});