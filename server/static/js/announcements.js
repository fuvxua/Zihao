// ========== Announcements JS ==========

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  var now = Date.now();
  var date = new Date(dateString).getTime();
  var diff = Math.floor((now - date) / 1000);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
  if (diff < 31536000) return Math.floor(diff / 2592000) + '个月前';
  return Math.floor(diff / 31536000) + '年前';
}

function startRelativeTimeUpdates() {
  setInterval(function() {
    var elements = document.querySelectorAll('[data-time="true"]');
    elements.forEach(function(el) {
      var dateString = el.getAttribute('data-date');
      if (dateString) {
        el.textContent = formatRelativeTime(dateString);
      }
    });
  }, 60000);
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadAnnouncements(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  try {
    var data = await apiFetch('/api/announcements?limit=50');
    if (!data.results || data.results.length === 0) {
      container.innerHTML = '<div class="text-center py-16 text-subtle">暂无公告</div>';
      return;
    }

    var html = '';
    data.results.forEach(function(ann) {
      html += '<div class="bg-white rounded-card shadow-sm shadow-green-900/5 border-l-4 border-primary p-5">';
      html += '<div class="text-lg font-semibold text-ink mb-2">' + escapeHtml(ann.title) + '</div>';
      html += '<div class="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words mb-2">' + escapeHtml(ann.content) + '</div>';
      html += '<div class="flex gap-4 text-sm text-slate-500">';
      html += '<span>' + escapeHtml(ann.authorName) + '</span>';
      html += '<span data-time="true" data-date="' + ann.createdAt + '">' + formatRelativeTime(ann.createdAt) + '</span>';
      html += '</div>';
      html += '</div>';
    });

    container.innerHTML = html;
    startRelativeTimeUpdates();
  } catch (e) {
    container.innerHTML = '<div class="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm">加载失败: ' + escapeHtml(e.message) + '</div>';
  }
}

async function loadAnnouncement(annId) {
  try {
    var ann = await apiFetch('/api/announcements/' + annId);
    return ann;
  } catch (e) {
    console.error('加载公告失败:', e);
    return null;
  }
}

async function markAnnouncementRead(annId) {
  try {
    await apiFetch('/api/announcements/' + annId + '/read', { method: 'POST' });
  } catch (e) {
    console.error('标记已读失败:', e);
  }
}

function showAnnouncementModal(ann) {
  var overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 flex items-center justify-center z-[1000]';

  var modal = document.createElement('div');
  modal.className = 'bg-white rounded-card shadow-lg w-[min(90vw,480px)] max-h-[80vh] overflow-y-auto';

  var header = document.createElement('div');
  header.className = 'flex items-center justify-between px-5 py-4 border-b border-slate-200/50';
  header.innerHTML = '<h3 class="text-base font-semibold text-primary">系统公告</h3><button class="text-xl cursor-pointer text-slate-500 hover:text-ink p-1 leading-none">&times;</button>';

  var body = document.createElement('div');
  body.className = 'px-5 py-5';
  body.innerHTML = '<h4 class="text-lg font-bold text-ink mb-3">' + escapeHtml(ann.title) + '</h4>' +
    '<div class="text-sm leading-[1.8] whitespace-pre-wrap break-words text-ink mb-4">' + escapeHtml(ann.content) + '</div>' +
    '<div class="text-sm text-slate-500">' + formatRelativeTime(ann.createdAt) + '</div>';

  var footer = document.createElement('div');
  footer.className = 'px-5 py-3 border-t border-slate-200/50 text-right';
  footer.innerHTML = '<button class="bg-primary text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-primary-hover transition-all" id="announcement-modal-ok">知道了</button>';

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var closeModal = function() {
    var user = JSON.parse(localStorage.getItem('forum_user') || '{}');
    if (user.objectId) {
      localStorage.setItem('lastSeenAnnouncement_' + user.objectId, ann.id);
    }
    markAnnouncementRead(ann.id);
    overlay.remove();
  };

  header.querySelector('button').addEventListener('click', closeModal);
  footer.querySelector('#announcement-modal-ok').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });
}

async function checkAndShowAnnouncementPopup() {
  if (!sessionStorage.getItem('showAnnouncementPopup')) return;
  sessionStorage.removeItem('showAnnouncementPopup');

  var user = await checkAuth();
  if (!user) return;

  try {
    var data = await apiFetch('/api/announcements/unread');
    if (!data.hasUnread || !data.announcement) return;

    var ann = data.announcement;
    var lastSeen = localStorage.getItem('lastSeenAnnouncement_' + user.objectId);
    if (lastSeen && parseInt(lastSeen) >= ann.id) return;

    showAnnouncementModal(ann);
  } catch (e) {
    console.error('检查公告失败:', e);
  }
}
