import requests
import sqlite3
import os

# Supabase 配置
SUPABASE_URL = 'https://tyqkxvngutamwbdjccwg.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5cWt4dm5ndXRhbXdiZGpjY3dnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODg4MjgsImV4cCI6MjA5Mzk2NDgyOH0.LHdrhCkAlEgUwH_a-4IwoNkbJiixxxe_hre-K-K4omU'

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'forum.db')

headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
    'Content-Type': 'application/json'
}

def fetch_supabase(table):
    """从 Supabase 获取表数据"""
    url = f'{SUPABASE_URL}/rest/v1/{table}?select=*'
    print(f'正在获取 {table}...')
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        data = resp.json()
        print(f'  获取到 {len(data)} 条记录')
        return data
    else:
        print(f'  获取失败: {resp.status_code}')
        return []

def migrate():
    # 获取 Supabase 数据
    posts = fetch_supabase('posts')
    replies = fetch_supabase('replies')

    if not posts:
        print('没有数据需要迁移')
        return

    # 连接本地数据库
    db = sqlite3.connect(DB_PATH)
    db.execute('PRAGMA journal_mode=WAL')

    # 迁移帖子 - 字段名映射 (Supabase 下划线 -> 本地驼峰)
    print('\n迁移帖子...')
    migrated_posts = 0
    for p in posts:
        try:
            # 获取 author_id，如果本地没有对应用户则设为 1 (admin)
            author_id = 1  # 默认 admin
            author_name = p.get('author_name', '未知用户')
            avatar_url = p.get('avatar_url', '')

            db.execute('''INSERT OR REPLACE INTO posts
                (id, title, content, authorId, authorName, avatarUrl, viewCount, replyCount, isPinned, isLocked, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (p.get('id'), p.get('title', ''), p.get('content', ''),
                 author_id, author_name, avatar_url,
                 p.get('view_count', 0), p.get('reply_count', 0),
                 1 if p.get('is_pinned') else 0, 1 if p.get('is_locked') else 0,
                 p.get('created_at', '')))
            migrated_posts += 1
            print(f'  帖子: {p.get("title", "")[:30]}')
        except Exception as e:
            print(f'  跳过帖子: {e}')

    # 迁移回复
    print('\n迁移回复...')
    migrated_replies = 0
    for r in replies:
        try:
            author_id = 1  # 默认 admin
            author_name = r.get('author_name', '未知用户')

            db.execute('''INSERT OR REPLACE INTO replies
                (id, postId, content, authorId, authorName, avatarUrl, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (r.get('id'), r.get('post_id'), r.get('content', ''),
                 author_id, author_name, r.get('avatar_url', ''),
                 r.get('created_at', '')))
            migrated_replies += 1
        except Exception as e:
            print(f'  跳过回复: {e}')

    db.commit()

    # 统计
    stats = {
        'users': db.execute('SELECT COUNT(*) FROM users').fetchone()[0],
        'posts': db.execute('SELECT COUNT(*) FROM posts').fetchone()[0],
        'replies': db.execute('SELECT COUNT(*) FROM replies').fetchone()[0]
    }
    db.close()

    print(f'\n迁移完成!')
    print(f'  用户: {stats["users"]} (Supabase 用户需重新注册)')
    print(f'  帖子: {stats["posts"]} (迁移了 {migrated_posts} 条)')
    print(f'  回复: {stats["replies"]} (迁移了 {migrated_replies} 条)')

if __name__ == '__main__':
    migrate()
