import os
import sqlite3
import hashlib
import secrets
import json
import time
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, g

app = Flask(__name__, static_folder=None)
app.secret_key = secrets.token_hex(32)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'forum.db')
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# ========== Database ==========

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT,
            displayName TEXT,
            avatarUrl TEXT DEFAULT '',
            backgroundUrl TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            sessionToken TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            authorId INTEGER NOT NULL,
            authorName TEXT NOT NULL,
            avatarUrl TEXT DEFAULT '',
            viewCount INTEGER DEFAULT 0,
            replyCount INTEGER DEFAULT 0,
            isPinned INTEGER DEFAULT 0,
            isLocked INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (authorId) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            postId INTEGER NOT NULL,
            content TEXT NOT NULL,
            authorId INTEGER NOT NULL,
            authorName TEXT NOT NULL,
            avatarUrl TEXT DEFAULT '',
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (postId) REFERENCES posts(id),
            FOREIGN KEY (authorId) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(createdAt DESC);
        CREATE INDEX IF NOT EXISTS idx_replies_post ON replies(postId);
        CREATE INDEX IF NOT EXISTS idx_users_session ON users(sessionToken);

        CREATE TABLE IF NOT EXISTS post_likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            postId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (postId) REFERENCES posts(id),
            FOREIGN KEY (userId) REFERENCES users(id),
            UNIQUE(postId, userId)
        );
        CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(postId);

        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1Id INTEGER NOT NULL,
            user1Name TEXT NOT NULL,
            user1AvatarUrl TEXT DEFAULT '',
            user2Id INTEGER NOT NULL,
            user2Name TEXT NOT NULL,
            user2AvatarUrl TEXT DEFAULT '',
            lastMessage TEXT DEFAULT '',
            lastMessageAt TEXT DEFAULT (datetime('now')),
            unreadCount1 INTEGER DEFAULT 0,
            unreadCount2 INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user1Id) REFERENCES users(id),
            FOREIGN KEY (user2Id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversationId INTEGER NOT NULL,
            senderId INTEGER NOT NULL,
            senderName TEXT NOT NULL,
            senderAvatarUrl TEXT DEFAULT '',
            content TEXT NOT NULL,
            isRead INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (conversationId) REFERENCES conversations(id),
            FOREIGN KEY (senderId) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_conv_user1 ON conversations(user1Id);
        CREATE INDEX IF NOT EXISTS idx_conv_user2 ON conversations(user2Id);
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversationId, createdAt DESC);

        CREATE TABLE IF NOT EXISTS guestbook (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            userName TEXT NOT NULL,
            avatarUrl TEXT DEFAULT '',
            content TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (userId) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook(createdAt DESC);

        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            authorId INTEGER NOT NULL,
            authorName TEXT NOT NULL,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT DEFAULT (datetime('now')),
            updatedAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (authorId) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(createdAt DESC);

        CREATE TABLE IF NOT EXISTS announcement_reads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            announcementId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            createdAt TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (announcementId) REFERENCES announcements(id),
            FOREIGN KEY (userId) REFERENCES users(id),
            UNIQUE(announcementId, userId)
        );
        CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(userId);
    ''')

    columns = [row[1] for row in db.execute('PRAGMA table_info(users)').fetchall()]
    if 'backgroundUrl' not in columns:
        db.execute("ALTER TABLE users ADD COLUMN backgroundUrl TEXT DEFAULT ''")

    post_columns = [row[1] for row in db.execute('PRAGMA table_info(posts)').fetchall()]
    if 'likeCount' not in post_columns:
        db.execute("ALTER TABLE posts ADD COLUMN likeCount INTEGER DEFAULT 0")

    # Create admin user if not exists
    cur = db.execute('SELECT id FROM users WHERE username = ?', ('admin',))
    if not cur.fetchone():
        pw = hashlib.sha256('admin123'.encode()).hexdigest()
        db.execute('INSERT INTO users (username, password, email, displayName, role) VALUES (?, ?, ?, ?, ?)',
                   ('admin', pw, 'admin@forum.com', '管理员', 'admin'))
    db.commit()
    db.close()

# ========== Auth helpers ==========

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def get_current_user():
    token = request.headers.get('X-Session-Token', '')
    if not token:
        return None
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE sessionToken = ?', (token,)).fetchone()
    return dict(user) if user else None

def require_login(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': '未登录'}), 401
        return f(user, *args, **kwargs)
    return decorated

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': '未登录'}), 401
        if user['role'] != 'admin':
            return jsonify({'error': '权限不足'}), 403
        return f(user, *args, **kwargs)
    return decorated

# ========== Auth API ==========

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    email = data.get('email', '').strip()
    display_name = data.get('displayName', '').strip()

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码至少6位'}), 400

    db = get_db()
    existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
    if existing:
        return jsonify({'error': '用户名已存在'}), 400

    pw_hash = hash_password(password)
    cur = db.execute('INSERT INTO users (username, password, email, displayName) VALUES (?, ?, ?, ?)',
                     (username, pw_hash, email, display_name or username))
    db.commit()
    user_id = cur.lastrowid
    return jsonify({'objectId': user_id, 'username': username, 'displayName': display_name or username})

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')

    db = get_db()
    pw_hash = hash_password(password)
    user = db.execute('SELECT * FROM users WHERE username = ? AND password = ?', (username, pw_hash)).fetchone()
    if not user:
        return jsonify({'error': '用户名或密码错误'}), 401

    token = secrets.token_hex(32)
    db.execute('UPDATE users SET sessionToken = ? WHERE id = ?', (token, user['id']))
    db.commit()

    return jsonify({
        'objectId': user['id'],
        'username': user['username'],
        'email': user['email'],
        'displayName': user['displayName'],
        'avatarUrl': user['avatarUrl'],
        'backgroundUrl': user['backgroundUrl'],
        'role': user['role'],
        'sessionToken': token
    })

@app.route('/api/users/me', methods=['GET'])
@require_login
def api_current_user(user):
    return jsonify({
        'objectId': user['id'],
        'username': user['username'],
        'email': user['email'],
        'displayName': user['displayName'],
        'avatarUrl': user['avatarUrl'],
        'backgroundUrl': user['backgroundUrl'],
        'role': user['role'],
        'sessionToken': user['sessionToken']
    })

@app.route('/api/users/<int:user_id>', methods=['GET'])
def api_get_user(user_id):
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not user:
        return jsonify({'error': '用户不存在'}), 404

    return jsonify({
        'objectId': user['id'],
        'username': user['username'],
        'displayName': user['displayName'],
        'avatarUrl': user['avatarUrl'],
        'backgroundUrl': user['backgroundUrl'],
        'role': user['role'],
        'createdAt': user['createdAt']
    })

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@require_login
def api_update_user(current_user, user_id):
    if current_user['id'] != user_id and current_user['role'] != 'admin':
        return jsonify({'error': '没有权限'}), 403

    data = request.get_json()
    db = get_db()
    allowed = ['displayName', 'avatarUrl', 'backgroundUrl', 'email']
    updates = []
    values = []
    for key in allowed:
        if key in data:
            updates.append(f'{key} = ?')
            values.append(data[key])

    if not updates:
        return jsonify({'error': '没有要更新的数据'}), 400

    values.append(user_id)
    db.execute(f'UPDATE users SET {", ".join(updates)} WHERE id = ?', values)
    db.commit()

    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    return jsonify({
        'objectId': user['id'],
        'username': user['username'],
        'email': user['email'],
        'displayName': user['displayName'],
        'avatarUrl': user['avatarUrl'],
        'backgroundUrl': user['backgroundUrl'],
        'role': user['role'],
        'sessionToken': user['sessionToken']
    })

@app.route('/api/users/me/password', methods=['POST'])
@require_login
def api_change_password(user):
    data = request.get_json()
    old_password = data.get('oldPassword', '')
    new_password = data.get('newPassword', '')

    if not old_password or not new_password:
        return jsonify({'error': '旧密码和新密码不能为空'}), 400
    if len(new_password) < 6:
        return jsonify({'error': '新密码至少6位'}), 400

    db = get_db()
    pw_hash = hash_password(old_password)
    current = db.execute('SELECT id FROM users WHERE id = ? AND password = ?', (user['id'], pw_hash)).fetchone()
    if not current:
        return jsonify({'error': '旧密码不正确'}), 400

    db.execute('UPDATE users SET password = ? WHERE id = ?', (hash_password(new_password), user['id']))
    db.commit()
    return jsonify({'ok': True})

# ========== Posts API ==========

@app.route('/api/posts', methods=['GET'])
def api_list_posts():
    db = get_db()
    limit = min(int(request.args.get('limit', 20)), 100)
    skip = int(request.args.get('skip', 0))

    total = db.execute('SELECT COUNT(*) as c FROM posts').fetchone()['c']
    posts = db.execute(
        'SELECT * FROM posts ORDER BY isPinned DESC, likeCount DESC, createdAt DESC LIMIT ? OFFSET ?',
        (limit, skip)
    ).fetchall()

    # 为每个帖子添加当前用户是否已点赞
    user = get_current_user()
    results = []
    for p in posts:
        post = dict(p)
        if user:
            liked = db.execute(
                'SELECT id FROM post_likes WHERE postId = ? AND userId = ?',
                (p['id'], user['id'])
            ).fetchone()
            post['isLiked'] = bool(liked)
        else:
            post['isLiked'] = False
        results.append(post)

    return jsonify({
        'results': results,
        'count': total
    })

@app.route('/api/posts/<int:post_id>', methods=['GET'])
def api_get_post(post_id):
    db = get_db()
    post = db.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404

    db.execute('UPDATE posts SET viewCount = viewCount + 1 WHERE id = ?', (post_id,))
    db.commit()

    result = dict(post)
    result['viewCount'] = result['viewCount'] + 1

    user = get_current_user()
    if user:
        liked = db.execute(
            'SELECT id FROM post_likes WHERE postId = ? AND userId = ?',
            (post_id, user['id'])
        ).fetchone()
        result['isLiked'] = bool(liked)
    else:
        result['isLiked'] = False

    return jsonify(result)

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
@require_login
def api_toggle_like(user, post_id):
    db = get_db()
    post = db.execute('SELECT id FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404

    existing = db.execute(
        'SELECT id FROM post_likes WHERE postId = ? AND userId = ?',
        (post_id, user['id'])
    ).fetchone()

    if existing:
        db.execute('DELETE FROM post_likes WHERE id = ?', (existing['id'],))
        db.execute('UPDATE posts SET likeCount = MAX(0, likeCount - 1) WHERE id = ?', (post_id,))
        db.commit()
        return jsonify({'liked': False, 'likeCount': db.execute('SELECT likeCount FROM posts WHERE id = ?', (post_id,)).fetchone()['likeCount']})
    else:
        db.execute('INSERT INTO post_likes (postId, userId) VALUES (?, ?)', (post_id, user['id']))
        db.execute('UPDATE posts SET likeCount = likeCount + 1 WHERE id = ?', (post_id,))
        db.commit()
        return jsonify({'liked': True, 'likeCount': db.execute('SELECT likeCount FROM posts WHERE id = ?', (post_id,)).fetchone()['likeCount']})

@app.route('/api/posts', methods=['POST'])
@require_login
def api_create_post(user):
    data = request.get_json()
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title or not content:
        return jsonify({'error': '标题和内容不能为空'}), 400

    db = get_db()
    cur = db.execute(
        'INSERT INTO posts (title, content, authorId, authorName, avatarUrl) VALUES (?, ?, ?, ?, ?)',
        (title, content, user['id'], user['displayName'] or user['username'], user['avatarUrl'] or '')
    )
    db.commit()
    return jsonify({'objectId': cur.lastrowid, 'createdAt': datetime.now().isoformat()})

@app.route('/api/posts/<int:post_id>', methods=['PUT'])
@require_login
def api_update_post(user, post_id):
    db = get_db()
    post = db.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404
    if post['authorId'] != user['id'] and user['role'] != 'admin':
        return jsonify({'error': '没有权限编辑'}), 403

    data = request.get_json()
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title or not content:
        return jsonify({'error': '标题和内容不能为空'}), 400

    db.execute('UPDATE posts SET title = ?, content = ? WHERE id = ?', (title, content, post_id))
    db.commit()
    return jsonify({'updatedAt': datetime.now().isoformat()})

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
@require_login
def api_delete_post(user, post_id):
    db = get_db()
    post = db.execute('SELECT * FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404
    if post['authorId'] != user['id'] and user['role'] != 'admin':
        return jsonify({'error': '没有权限删除'}), 403

    db.execute('DELETE FROM replies WHERE postId = ?', (post_id,))
    db.execute('DELETE FROM posts WHERE id = ?', (post_id,))
    db.commit()
    return jsonify({'ok': True})

# ========== Replies API ==========

@app.route('/api/posts/<int:post_id>/replies', methods=['GET'])
def api_list_replies(post_id):
    db = get_db()
    replies = db.execute(
        'SELECT * FROM replies WHERE postId = ? ORDER BY createdAt ASC',
        (post_id,)
    ).fetchall()
    return jsonify({'results': [dict(r) for r in replies]})

@app.route('/api/posts/<int:post_id>/replies', methods=['POST'])
@require_login
def api_create_reply(user, post_id):
    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': '回复内容不能为空'}), 400

    db = get_db()
    post = db.execute('SELECT id FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404

    db.execute(
        'INSERT INTO replies (postId, content, authorId, authorName, avatarUrl) VALUES (?, ?, ?, ?, ?)',
        (post_id, content, user['id'], user['displayName'] or user['username'], user['avatarUrl'] or '')
    )
    db.execute('UPDATE posts SET replyCount = replyCount + 1 WHERE id = ?', (post_id,))
    db.commit()
    return jsonify({'createdAt': datetime.now().isoformat()})

@app.route('/api/replies/<int:reply_id>', methods=['DELETE'])
@require_login
def api_delete_reply(user, reply_id):
    db = get_db()
    reply = db.execute('SELECT * FROM replies WHERE id = ?', (reply_id,)).fetchone()
    if not reply:
        return jsonify({'error': '回复不存在'}), 404
    if reply['authorId'] != user['id'] and user['role'] != 'admin':
        return jsonify({'error': '没有权限删除'}), 403

    db.execute('DELETE FROM replies WHERE id = ?', (reply_id,))
    db.execute('UPDATE posts SET replyCount = MAX(0, replyCount - 1) WHERE id = ?', (reply['postId'],))
    db.commit()
    return jsonify({'ok': True})

# ========== Guestbook API ==========

@app.route('/api/guestbook', methods=['GET'])
def api_list_guestbook():
    db = get_db()
    limit = min(int(request.args.get('limit', 50)), 100)
    skip = int(request.args.get('skip', 0))

    total = db.execute('SELECT COUNT(*) as c FROM guestbook').fetchone()['c']
    entries = db.execute(
        'SELECT * FROM guestbook ORDER BY createdAt DESC LIMIT ? OFFSET ?',
        (limit, skip)
    ).fetchall()

    return jsonify({
        'results': [dict(e) for e in entries],
        'count': total
    })

@app.route('/api/guestbook', methods=['POST'])
@require_login
def api_create_guestbook(user):
    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': '留言内容不能为空'}), 400

    db = get_db()
    cur = db.execute(
        'INSERT INTO guestbook (userId, userName, avatarUrl, content) VALUES (?, ?, ?, ?)',
        (user['id'], user['displayName'] or user['username'], user['avatarUrl'] or '', content)
    )
    db.commit()
    return jsonify({'objectId': cur.lastrowid, 'createdAt': datetime.now().isoformat()})

@app.route('/api/guestbook/<int:entry_id>', methods=['DELETE'])
@require_login
def api_delete_guestbook(user, entry_id):
    db = get_db()
    entry = db.execute('SELECT * FROM guestbook WHERE id = ?', (entry_id,)).fetchone()
    if not entry:
        return jsonify({'error': '留言不存在'}), 404
    if entry['userId'] != user['id'] and user['role'] != 'admin':
        return jsonify({'error': '没有权限删除'}), 403

    db.execute('DELETE FROM guestbook WHERE id = ?', (entry_id,))
    db.commit()
    return jsonify({'ok': True})

# ========== Announcements API ==========

@app.route('/api/announcements', methods=['GET'])
def api_list_announcements():
    db = get_db()
    limit = min(int(request.args.get('limit', 20)), 100)
    skip = int(request.args.get('skip', 0))

    total = db.execute('SELECT COUNT(*) as c FROM announcements WHERE isActive = 1').fetchone()['c']
    announcements = db.execute(
        'SELECT * FROM announcements WHERE isActive = 1 ORDER BY createdAt DESC LIMIT ? OFFSET ?',
        (limit, skip)
    ).fetchall()

    return jsonify({
        'results': [dict(a) for a in announcements],
        'count': total
    })

@app.route('/api/announcements/<int:ann_id>', methods=['GET'])
def api_get_announcement(ann_id):
    db = get_db()
    announcement = db.execute('SELECT * FROM announcements WHERE id = ?', (ann_id,)).fetchone()
    if not announcement:
        return jsonify({'error': '公告不存在'}), 404
    return jsonify(dict(announcement))

@app.route('/api/announcements/latest', methods=['GET'])
def api_get_latest_announcement():
    db = get_db()
    announcement = db.execute(
        'SELECT * FROM announcements WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1'
    ).fetchone()
    return jsonify({'announcement': dict(announcement) if announcement else None})

@app.route('/api/announcements/unread', methods=['GET'])
@require_login
def api_check_unread_announcements(user):
    db = get_db()
    announcement = db.execute(
        'SELECT * FROM announcements WHERE isActive = 1 ORDER BY createdAt DESC LIMIT 1'
    ).fetchone()

    if not announcement:
        return jsonify({'hasUnread': False, 'announcement': None})

    read = db.execute(
        'SELECT id FROM announcement_reads WHERE announcementId = ? AND userId = ?',
        (announcement['id'], user['id'])
    ).fetchone()

    return jsonify({
        'hasUnread': read is None,
        'announcement': dict(announcement)
    })

@app.route('/api/announcements/<int:ann_id>/read', methods=['POST'])
@require_login
def api_mark_announcement_read(user, ann_id):
    db = get_db()
    db.execute(
        'INSERT OR IGNORE INTO announcement_reads (announcementId, userId) VALUES (?, ?)',
        (ann_id, user['id'])
    )
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/announcements', methods=['POST'])
@require_admin
def api_create_announcement(user):
    data = request.get_json()
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title or not content:
        return jsonify({'error': '标题和内容不能为空'}), 400

    db = get_db()
    cur = db.execute(
        'INSERT INTO announcements (title, content, authorId, authorName) VALUES (?, ?, ?, ?)',
        (title, content, user['id'], user['displayName'] or user['username'])
    )
    db.commit()
    return jsonify({'objectId': cur.lastrowid, 'createdAt': datetime.now().isoformat()})

@app.route('/api/admin/announcements/<int:ann_id>', methods=['PUT'])
@require_admin
def api_update_announcement(user, ann_id):
    data = request.get_json()
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()

    if not title or not content:
        return jsonify({'error': '标题和内容不能为空'}), 400

    db = get_db()
    announcement = db.execute('SELECT * FROM announcements WHERE id = ?', (ann_id,)).fetchone()
    if not announcement:
        return jsonify({'error': '公告不存在'}), 404

    db.execute(
        'UPDATE announcements SET title = ?, content = ?, updatedAt = datetime(\'now\') WHERE id = ?',
        (title, content, ann_id)
    )
    db.commit()
    return jsonify({'updatedAt': datetime.now().isoformat()})

@app.route('/api/admin/announcements/<int:ann_id>', methods=['DELETE'])
@require_admin
def api_delete_announcement(user, ann_id):
    db = get_db()
    announcement = db.execute('SELECT * FROM announcements WHERE id = ?', (ann_id,)).fetchone()
    if not announcement:
        return jsonify({'error': '公告不存在'}), 404

    db.execute('DELETE FROM announcement_reads WHERE announcementId = ?', (ann_id,))
    db.execute('DELETE FROM announcements WHERE id = ?', (ann_id,))
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/announcements/<int:ann_id>/toggle', methods=['POST'])
@require_admin
def api_toggle_announcement(user, ann_id):
    db = get_db()
    announcement = db.execute('SELECT * FROM announcements WHERE id = ?', (ann_id,)).fetchone()
    if not announcement:
        return jsonify({'error': '公告不存在'}), 404

    new_status = 0 if announcement['isActive'] else 1
    db.execute('UPDATE announcements SET isActive = ?, updatedAt = datetime(\'now\') WHERE id = ?', (new_status, ann_id))
    db.commit()
    return jsonify({'isActive': new_status})

# ========== Conversations API ==========

@app.route('/api/conversations', methods=['GET'])
@require_login
def api_list_conversations(user):
    db = get_db()
    conversations = db.execute(
        '''SELECT * FROM conversations
           WHERE user1Id = ? OR user2Id = ?
           ORDER BY lastMessageAt DESC''',
        (user['id'], user['id'])
    ).fetchall()

    results = []
    for conv in conversations:
        c = dict(conv)
        if c['user1Id'] == user['id']:
            c['otherUserId'] = c['user2Id']
            c['otherUserName'] = c['user2Name']
            c['otherUserAvatarUrl'] = c['user2AvatarUrl']
            c['unreadCount'] = c['unreadCount1']
        else:
            c['otherUserId'] = c['user1Id']
            c['otherUserName'] = c['user1Name']
            c['otherUserAvatarUrl'] = c['user1AvatarUrl']
            c['unreadCount'] = c['unreadCount2']
        results.append(c)

    return jsonify({'results': results, 'count': len(results)})

@app.route('/api/conversations', methods=['POST'])
@require_login
def api_create_conversation(user):
    data = request.get_json()
    target_id = data.get('targetUserId')

    if not target_id or target_id == user['id']:
        return jsonify({'error': '无效的目标用户'}), 400

    db = get_db()
    target = db.execute('SELECT * FROM users WHERE id = ?', (target_id,)).fetchone()
    if not target:
        return jsonify({'error': '用户不存在'}), 404

    # 确保 user1Id < user2Id 以保证唯一性
    u1, u2 = sorted([
        (user['id'], user['displayName'] or user['username'], user['avatarUrl'] or ''),
        (target['id'], target['displayName'] or target['username'], target['avatarUrl'] or '')
    ], key=lambda x: x[0])

    # 查找已有会话
    existing = db.execute(
        'SELECT * FROM conversations WHERE user1Id = ? AND user2Id = ?',
        (u1[0], u2[0])
    ).fetchone()

    if existing:
        return jsonify({'objectId': existing['id']})

    cur = db.execute(
        '''INSERT INTO conversations (user1Id, user1Name, user1AvatarUrl, user2Id, user2Name, user2AvatarUrl)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (u1[0], u1[1], u1[2], u2[0], u2[1], u2[2])
    )
    db.commit()
    return jsonify({'objectId': cur.lastrowid})

@app.route('/api/conversations/<int:conv_id>/messages', methods=['GET'])
@require_login
def api_get_messages(user, conv_id):
    db = get_db()
    conv = db.execute('SELECT * FROM conversations WHERE id = ?', (conv_id,)).fetchone()
    if not conv:
        return jsonify({'error': '会话不存在'}), 404
    if conv['user1Id'] != user['id'] and conv['user2Id'] != user['id']:
        return jsonify({'error': '无权访问'}), 403

    limit = min(int(request.args.get('limit', 50)), 100)
    before = request.args.get('before')

    if before:
        messages = db.execute(
            '''SELECT * FROM messages WHERE conversationId = ? AND id < ?
               ORDER BY createdAt DESC LIMIT ?''',
            (conv_id, before, limit)
        ).fetchall()
    else:
        messages = db.execute(
            '''SELECT * FROM messages WHERE conversationId = ?
               ORDER BY createdAt DESC LIMIT ?''',
            (conv_id, limit)
        ).fetchall()

    # 标记对方消息为已读
    db.execute(
        'UPDATE messages SET isRead = 1 WHERE conversationId = ? AND senderId != ? AND isRead = 0',
        (conv_id, user['id'])
    )
    # 重置当前用户未读计数
    if conv['user1Id'] == user['id']:
        db.execute('UPDATE conversations SET unreadCount1 = 0 WHERE id = ?', (conv_id,))
    else:
        db.execute('UPDATE conversations SET unreadCount2 = 0 WHERE id = ?', (conv_id,))
    db.commit()

    return jsonify({'results': [dict(m) for m in messages]})

@app.route('/api/conversations/<int:conv_id>/messages', methods=['POST'])
@require_login
def api_send_message(user, conv_id):
    data = request.get_json()
    content = data.get('content', '').strip()

    if not content:
        return jsonify({'error': '消息内容不能为空'}), 400

    db = get_db()
    conv = db.execute('SELECT * FROM conversations WHERE id = ?', (conv_id,)).fetchone()
    if not conv:
        return jsonify({'error': '会话不存在'}), 404
    if conv['user1Id'] != user['id'] and conv['user2Id'] != user['id']:
        return jsonify({'error': '无权访问'}), 403

    cur = db.execute(
        '''INSERT INTO messages (conversationId, senderId, senderName, senderAvatarUrl, content)
           VALUES (?, ?, ?, ?, ?)''',
        (conv_id, user['id'], user['displayName'] or user['username'], user['avatarUrl'] or '', content)
    )

    # 更新会话的最后消息和未读计数
    if conv['user1Id'] == user['id']:
        db.execute(
            "UPDATE conversations SET lastMessage = ?, lastMessageAt = datetime('now'), unreadCount2 = unreadCount2 + 1 WHERE id = ?",
            (content[:100], conv_id)
        )
    else:
        db.execute(
            "UPDATE conversations SET lastMessage = ?, lastMessageAt = datetime('now'), unreadCount1 = unreadCount1 + 1 WHERE id = ?",
            (content[:100], conv_id)
        )
    db.commit()

    msg_id = cur.lastrowid
    now = datetime.now().isoformat()
    return jsonify({
        'id': msg_id,
        'conversationId': conv_id,
        'senderId': user['id'],
        'senderName': user['displayName'] or user['username'],
        'senderAvatarUrl': user['avatarUrl'] or '',
        'content': content,
        'isRead': 0,
        'createdAt': now,
        'objectId': msg_id,
    })

@app.route('/api/conversations/unread-count', methods=['GET'])
@require_login
def api_unread_count(user):
    db = get_db()
    row = db.execute(
        '''SELECT
             SUM(CASE WHEN user1Id = ? THEN unreadCount1 ELSE unreadCount2 END) as total
           FROM conversations
           WHERE user1Id = ? OR user2Id = ?''',
        (user['id'], user['id'], user['id'])
    ).fetchone()
    total = row['total'] or 0
    return jsonify({'count': total})

# ========== File Upload ==========

@app.route('/api/upload', methods=['POST'])
@require_login
def api_upload(user):
    if 'file' not in request.files:
        return jsonify({'error': '没有文件'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': '没有文件'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', '.avi'):
        return jsonify({'error': '不支持的文件格式'}), 400

    filename = f'{int(time.time())}_{secrets.token_hex(4)}{ext}'
    filepath = os.path.join(UPLOAD_DIR, filename)
    file.save(filepath)

    url = f'/uploads/{filename}'
    return jsonify({'url': url, 'filename': filename})

# ========== Admin API ==========

@app.route('/api/admin/posts', methods=['GET'])
@require_admin
def api_admin_posts(user):
    db = get_db()
    page = int(request.args.get('page', 1))
    page_size = 20
    skip = (page - 1) * page_size

    total = db.execute('SELECT COUNT(*) as c FROM posts').fetchone()['c']
    posts = db.execute(
        'SELECT * FROM posts ORDER BY createdAt DESC LIMIT ? OFFSET ?',
        (page_size, skip)
    ).fetchall()

    return jsonify({
        'results': [dict(p) for p in posts],
        'count': total
    })

@app.route('/api/admin/posts/<int:post_id>/pin', methods=['POST'])
@require_admin
def api_toggle_pin(user, post_id):
    db = get_db()
    post = db.execute('SELECT isPinned FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404
    new_val = 0 if post['isPinned'] else 1
    db.execute('UPDATE posts SET isPinned = ? WHERE id = ?', (new_val, post_id))
    db.commit()
    return jsonify({'isPinned': new_val})

@app.route('/api/admin/posts/<int:post_id>/lock', methods=['POST'])
@require_admin
def api_toggle_lock(user, post_id):
    db = get_db()
    post = db.execute('SELECT isLocked FROM posts WHERE id = ?', (post_id,)).fetchone()
    if not post:
        return jsonify({'error': '帖子不存在'}), 404
    new_val = 0 if post['isLocked'] else 1
    db.execute('UPDATE posts SET isLocked = ? WHERE id = ?', (new_val, post_id))
    db.commit()
    return jsonify({'isLocked': new_val})

@app.route('/api/admin/users', methods=['GET'])
@require_admin
def api_admin_users(user):
    db = get_db()
    users = db.execute('SELECT * FROM users ORDER BY createdAt DESC LIMIT 100').fetchall()
    return jsonify({'results': [dict(u) for u in users]})

@app.route('/api/admin/users/<int:user_id>/role', methods=['POST'])
@require_admin
def api_set_role(admin_user, user_id):
    data = request.get_json()
    role = data.get('role', 'user')
    if role not in ('user', 'moderator', 'admin'):
        return jsonify({'error': '无效角色'}), 400

    db = get_db()
    db.execute('UPDATE users SET role = ? WHERE id = ?', (role, user_id))
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_admin
def api_delete_user(admin_user, user_id):
    if admin_user['id'] == user_id:
        return jsonify({'error': '不能删除自己的账号'}), 400

    db = get_db()
    target = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    if not target:
        return jsonify({'error': '用户不存在'}), 404

    if target['role'] == 'admin':
        admin_count = db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").fetchone()['c']
        if admin_count <= 1:
            return jsonify({'error': '不能删除最后一个管理员'}), 400

    db.execute("UPDATE posts SET authorName = ?, avatarUrl = '' WHERE authorId = ?", ('已注销用户', user_id))
    db.execute("UPDATE replies SET authorName = ?, avatarUrl = '' WHERE authorId = ?", ('已注销用户', user_id))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    return jsonify({'ok': True})

@app.route('/api/admin/stats', methods=['GET'])
@require_admin
def api_stats(user):
    db = get_db()
    total_posts = db.execute('SELECT COUNT(*) as c FROM posts').fetchone()['c']
    total_users = db.execute('SELECT COUNT(*) as c FROM users').fetchone()['c']
    today = datetime.now().strftime('%Y-%m-%d')
    today_posts = db.execute(
        "SELECT COUNT(*) as c FROM posts WHERE createdAt >= ?", (today,)
    ).fetchone()['c']
    return jsonify({
        'totalPosts': total_posts,
        'totalUsers': total_users,
        'todayPosts': today_posts
    })

# ========== Static Files ==========

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route('/')
def serve_index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)

# ========== Start ==========

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('FLASK_PORT', 5000))
    app.run(host='127.0.0.1', port=port, debug=False)
