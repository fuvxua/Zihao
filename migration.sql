-- ========== 论坛数据库迁移脚本 ==========
-- 请在 Supabase Dashboard > SQL Editor 中执行此脚本

-- 1. 用户角色表
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- 2. is_admin() 函数
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. posts 表新增字段
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0;

-- 4. 浏览量递增函数
CREATE OR REPLACE FUNCTION increment_view_count(post_id uuid)
RETURNS void AS $$
  UPDATE posts SET view_count = view_count + 1 WHERE id = post_id;
$$ LANGUAGE sql;

-- 5. 回复数自动更新触发器
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET reply_count = reply_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reply_count_trigger ON replies;
CREATE TRIGGER reply_count_trigger
AFTER INSERT OR DELETE ON replies
FOR EACH ROW EXECUTE FUNCTION update_reply_count();

-- 6. 用户列表视图（管理员查看用户用）
CREATE OR REPLACE VIEW user_list AS
SELECT
  u.id,
  u.email,
  u.created_at,
  u.raw_user_meta_data->>'display_name' as display_name,
  COALESCE(r.role, 'user') as role
FROM auth.users u
LEFT JOIN user_roles r ON u.id = r.user_id;

-- 7. 启用 RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

-- 8. user_roles 表策略
DROP POLICY IF EXISTS "Anyone can read roles" ON user_roles;
CREATE POLICY "Anyone can read roles" ON user_roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;
CREATE POLICY "Only admins can manage roles" ON user_roles FOR ALL USING (is_admin());

-- 9. posts 表策略
DROP POLICY IF EXISTS "Authenticated can read posts" ON posts;
CREATE POLICY "Authenticated can read posts" ON posts FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create posts" ON posts;
CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors or admins can update posts" ON posts;
CREATE POLICY "Authors or admins can update posts" ON posts FOR UPDATE USING (auth.uid() = author_id OR is_admin());

DROP POLICY IF EXISTS "Authors or admins can delete posts" ON posts;
CREATE POLICY "Authors or admins can delete posts" ON posts FOR DELETE USING (auth.uid() = author_id OR is_admin());

-- 10. replies 表策略
DROP POLICY IF EXISTS "Authenticated can read replies" ON replies;
CREATE POLICY "Authenticated can read replies" ON replies FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can create replies" ON replies;
CREATE POLICY "Users can create replies" ON replies FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors or admins can delete replies" ON replies;
CREATE POLICY "Authors or admins can delete replies" ON replies FOR DELETE USING (auth.uid() = author_id OR is_admin());

-- ========== 完成 ==========
-- 接下来需要手动将你的账号设为管理员：
-- 1. 先用你的邮箱注册/登录论坛
-- 2. 在 Supabase Dashboard > Authentication > Users 中找到你的 UUID
-- 3. 执行下面的 SQL（替换 YOUR_USER_UUID）：
-- INSERT INTO user_roles (user_id, role) VALUES ('YOUR_USER_UUID_HERE', 'admin');
