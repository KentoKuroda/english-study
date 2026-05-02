// --- GitHub API 設定 ---
const GITHUB_CONFIG = {
    owner: 'KentoKuroda',
    repo: 'english-study',
    path: 'words.json',
};

const LS_TOKEN = 'github_token';
const LS_WORDS = 'english_words_v1';

let words = [];
let editingId = null;

// --- 初期化 ---
window.addEventListener('DOMContentLoaded', async () => {
    // 1. タブ切り替えイベントの設定
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            const targetPage = document.getElementById('page-' + btn.dataset.tab);
            if (targetPage) targetPage.classList.add('active');
            if (btn.dataset.tab === 'study' && typeof resetStudy === 'function') resetStudy();
        });
    });

    // 2. ローカルデータの読み込み
    const localData = localStorage.getItem(LS_WORDS);
    if (localData) {
        try {
            words = JSON.parse(localData);
            renderList();
        } catch (e) { console.error("Local load error", e); }
    }

    // 3. GitHubから同期
    await loadFromGitHub();
});

// --- グローバル関数 (HTMLから呼び出せるようにする) ---

window.openSettings = function() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        const savedToken = localStorage.getItem(LS_TOKEN);
        const tokenInput = document.getElementById('cfg-token');
        if (tokenInput && savedToken) tokenInput.value = savedToken;
        modal.classList.add('open');
    }
};

window.closeSettings = function() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('open');
};

window.saveSettings = async function() {
    const tokenInput = document.getElementById('cfg-token');
    if (tokenInput) {
        const token = tokenInput.value.trim();
        if (token) {
            localStorage.setItem(LS_TOKEN, token);
            window.closeSettings();
            await loadFromGitHub();
        }
    }
};

// --- 同期・表示ロジック ---

async function loadFromGitHub() {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;

    setSyncStatus('syncing', '同期中…');
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
            headers: { 'Authorization': `token ${token}`, 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content)));
        words = JSON.parse(content).words || [];
        
        localStorage.setItem(LS_WORDS, JSON.stringify(words));
        renderList();
        setSyncStatus('ok', '✓ 同期済み');
    } catch (e) {
        setSyncStatus('error', '✗ 同期失敗');
    }
}

async function saveToGitHub(wordsData) {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;

    setSyncStatus('syncing', '保存中…');
    try {
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const fileData = await getRes.json();
        const sha = fileData.sha;

        const content = btoa(unescape(encodeURIComponent(JSON.stringify({ words: wordsData }, null, 2))));
        
        await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update words", content: content, sha: sha })
        });
        setSyncStatus('ok', '✓ 保存完了');
    } catch (e) {
        setSyncStatus('error', '✗ 保存失敗');
    }
}

function renderList() {
    const tbody = document.getElementById('word-tbody');
    const badge = document.getElementById('count-badge');
    if (!tbody) return;

    badge.textContent = `${words.length} 件`;
    tbody.innerHTML = words.map(w => `
        <tr>
            <td><span class="status-select status-${(w.status || 'New').toLowerCase()}">${w.status || 'New'}</span></td>
            <td><div class="word-en">${w.en}</div></td>
            <td><div class="word-ja">${w.ja}</div></td>
            <td><div class="word-ex">${w.ex || ''}</div></td>
            <td></td>
        </tr>
    `).reverse().join('');
}

function setSyncStatus(state, text) {
    const el = document.getElementById('sync-status');
    if (el) { el.className = 'sync-status ' + state; el.textContent = text; }
}

// 保存ボタンのイベント
document.getElementById('btn-save')?.addEventListener('click', async () => {
    const en = document.getElementById('inp-en').value.trim();
    const ja = document.getElementById('inp-ja').value.trim();
    const ex = document.getElementById('inp-ex').value.trim();
    if (!en || !ja) return;

    words.push({ id: Date.now().toString(36), en, ja, ex, status: 'New' });
    renderList();
    localStorage.setItem(LS_WORDS, JSON.stringify(words));
    await saveToGitHub(words);
    
    document.getElementById('inp-en').value = '';
    document.getElementById('inp-ja').value = '';
    document.getElementById('inp-ex').value = '';
});