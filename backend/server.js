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
// UPLOAD MEDIA + MULTI-RESOLUTION HLS CONVERSION (1080p, 720p, 480p)
// ============================================================================
app.post('/api/upload', authenticateToken, upload.single('media'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'File tidak diunggah atau ditolak.' });
        }

        const filePath = req.file.path;
        const fileMime = req.file.mimetype;
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileId = path.basename(req.file.filename, path.extname(req.file.filename));

        if (fileMime.startsWith('video/')) {
            const outputFolder = path.join(HLS_DIR, fileId);
            fs.mkdirSync(outputFolder, { recursive: true });

            const thumbnailFilename = `thumb_${fileId}.jpg`;
            const thumbnailPath = path.join(UPLOAD_DIR, thumbnailFilename);

            // 1. Ekstrak thumbnail dari detik pertama
            await new Promise((resolve) => {
                ffmpeg(filePath)
                    .screenshots({
                        timestamps: ['00:00:01'],
                        filename: thumbnailFilename,
                        folder: UPLOAD_DIR,
                        size: '640x?'
                    })
                    .on('end', resolve)
                    .on('error', () => resolve());
            });

            // 2. Konversi Multi-Resolusi HLS (1080p, 720p, 480p) + Master Playlist
            const masterPlaylistPath = path.join(outputFolder, 'master.m3u8');
            
            // Subfolder untuk masing-masing resolusi
            const r1080p = path.join(outputFolder, '1080p');
            const r720p = path.join(outputFolder, '720p');
            const r480p = path.join(outputFolder, '480p');
            fs.mkdirSync(r1080p, { recursive: true });
            fs.mkdirSync(r720p, { recursive: true });
            fs.mkdirSync(r480p, { recursive: true });

            await new Promise((resolve, reject) => {
                ffmpeg(filePath)
                    // Output 1080p
                    .output(`${r1080p}/index.m3u8`)
                    .videoCodec('libx264')
                    .size('1920x1080')
                    .videoBitrate('5000k')
                    .audioCodec('aac')
                    .audioBitrate('192k')
                    .outputOptions(['-hls_time 10', '-hls_list_size 0', '-f hls'])

                    // Output 720p
                    .output(`${r720p}/index.m3u8`)
                    .videoCodec('libx264')
                    .size('1280x720')
                    .videoBitrate('2800k')
                    .audioCodec('aac')
                    .audioBitrate('128k')
                    .outputOptions(['-hls_time 10', '-hls_list_size 0', '-f hls'])

                    // Output 480p
                    .output(`${r480p}/index.m3u8`)
                    .videoCodec('libx264')
                    .size('854x480')
                    .videoBitrate('1400k')
                    .audioCodec('aac')
                    .audioBitrate('96k')
                    .outputOptions(['-hls_time 10', '-hls_list_size 0', '-f hls'])

                    .on('end', () => {
                        // Buat file master.m3u8 secara manual
                        const masterContent = 
`#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5500000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p/index.m3u8`;

                        fs.writeFileSync(masterPlaylistPath, masterContent);
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Error FFmpeg Multi-Resolution:', err);
                        reject(err);
                    })
                    .run();
            });

            const mediaUrl = `${baseUrl}/uploads/hls/${fileId}/master.m3u8`;
            const thumbnailUrl = fs.existsSync(thumbnailPath) ? `${baseUrl}/uploads/${thumbnailFilename}` : null;

            return res.json({
                message: 'Video berhasil dikonversi ke Multi-Resolution HLS',
                media_url: mediaUrl,
                thumbnail_url: thumbnailUrl,
                media_type: 'video'
            });
        }

        // Jika Gambar
        res.json({
            message: 'Gambar berhasil diunggah',
            media_url: `${baseUrl}/uploads/${req.file.filename}`,
            thumbnail_url: `${baseUrl}/uploads/${req.file.filename}`,
            media_type: 'image'
        });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Gagal mengunggah file', error: error.message });
    }
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
        const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM public.post_likes WHERE post_id = $1', [req.params.id]);
        res.json({ likes_count: countRes.rows[0].count });
    } catch (error) {
        res.status(500).json({ message: 'Gagal mengambil like', error: error.message });
    }
});

app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
    try {
        await pool.query('INSERT INTO public.post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, req.userId]);
        const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM public.post_likes WHERE post_id = $1', [req.params.id]);
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
        const insertRes = await pool.query(
            `INSERT INTO public.post_comments (post_id, user_id, comment_text) VALUES ($1, $2, $3) RETURNING id`,
            [req.params.id, req.userId, comment_text.trim()]
        );
        const newComment = await pool.query(
            `SELECT c.id, c.comment_text, c.created_at, u.id AS user_id, u.full_name, u.profile_photo_url 
             FROM public.post_comments c JOIN public.users u ON c.user_id = u.id WHERE c.id = $1`,
            [insertRes.rows[0].id]
        );
        res.status(201).json(newComment.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Gagal kirim komentar', error: error.message });
    }
});

app.delete('/api/posts/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM public.posts WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
        res.json({ message: 'Post dihapus.' });
    } catch (error) {
        res.status(500).json({ message: 'Gagal hapus post', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server REST API lokal berjalan di http://localhost:${PORT}`);
});