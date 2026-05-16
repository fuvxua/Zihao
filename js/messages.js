// ========== Guestbook / Messages JS ==========

var guestbookPage = 1;
var guestbookLimit = 20;

async function loadGuestbook(page) {
  page = page || 1;
  guestbookPage = page;
  var container = document.getElementById('guestbook-list');
  if (!container) return;

  try {
    var data = await apiFetch('/api/guestbook?page=' + page + '&limit=' + guestbookLimit);
    if (!data.results || data.results.length === 0) {
      container.innerHTML = '<div class="text-center py-16 text-subtle">暂无留言，来写第一条吧~</div>';
      document.getElementById('guestbook-pagination').innerHTML = '';
      return;
    }

    var currentUser = await checkAuth();
    var html = '';
    data.results.forEach(function(item) {
      var canDelete = currentUser && (currentUser.objectId == item.userId || currentUser.role === 'admin');
      html += '<div class="bg-white rounded-card shadow-sm shadow-green-900/5 p-5">';
      html += '<div class="flex items-center gap-3 mb-3">';
      html += renderUserAvatar(item.userName, item.avatarUrl, 36);
      html += '<div>';
      html += '<div class="text-sm font-semibold text-ink">' + escapeHtml(item.userName) + '</div>';
      html += '<div class="text-xs text-slate-400">' + formatRelativeTime(item.createdAt) + '</div>';
      html += '</div>';
      if (canDelete) {
        html += '<button class="ml-auto text-xs text-slate-400 hover:text-red-500 transition-colors" onclick="deleteGuestbook(' + item.id + ')">删除</button>';
      }
      html += '</div>';
      html += '<div class="text-sm text-ink leading-relaxed whitespace-pre-wrap break-words">' + escapeHtml(item.content) + '</div>';
      html += '</div>';
    });

    container.innerHTML = html;

    var totalPages = Math.ceil(data.total / guestbookLimit);
    renderGuestbookPagination(totalPages);
  } catch (e) {
    container.innerHTML = '<div class="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm">加载失败: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderGuestbookPagination(totalPages) {
  var pag = document.getElementById('guestbook-pagination');
  if (!pag || totalPages <= 1) { if (pag) pag.innerHTML = ''; return; }

  var html = '';
  for (var i = 1; i <= totalPages; i++) {
    if (i === guestbookPage) {
      html += '<span class="px-3 py-1.5 text-sm font-semibold bg-primary text-white rounded-lg">' + i + '</span>';
    } else {
      html += '<button class="px-3 py-1.5 text-sm text-slate-500 hover:bg-primary-light rounded-lg transition-colors" onclick="loadGuestbook(' + i + ')">' + i + '</button>';
    }
  }
  pag.innerHTML = html;
}

function renderGuestbookForm() {
  var area = document.getElementById('guestbook-form-area');
  if (!area) return;

  area.innerHTML =
    '<div class="bg-white rounded-card shadow-sm shadow-green-900/5 p-5">' +
      '<textarea id="guestbook-content" rows="3" placeholder="写下你的留言..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"></textarea>' +
      '<div class="flex justify-end mt-3">' +
        '<button onclick="submitGuestbook()" class="bg-primary text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-primary-hover transition-all">发布留言</button>' +
      '</div>' +
    '</div>';
}

async function submitGuestbook() {
  var textarea = document.getElementById('guestbook-content');
  var content = textarea.value.trim();
  if (!content) return;

  try {
    await apiFetch('/api/guestbook', {
      method: 'POST',
      body: JSON.stringify({ content: content })
    });
    textarea.value = '';
    loadGuestbook(1);
  } catch (e) {
    alert('发布失败: ' + e.message);
  }
}

async function deleteGuestbook(id) {
  if (!confirm('确定删除这条留言？')) return;
  try {
    await apiFetch('/api/guestbook/' + id, { method: 'DELETE' });
    loadGuestbook(guestbookPage);
  } catch (e) {
    alert('删除失败: ' + e.message);
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  var user = await checkAuth();
  if (user) renderGuestbookForm();
  loadGuestbook(1);
  startRelativeTimeUpdates();
});
