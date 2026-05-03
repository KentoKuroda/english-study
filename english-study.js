// --- 基本設定 ---
const APP_PASSWORD = '0101'; // 任意のパスワードを設定してください
const LS_TOKEN = 'github_token';
const LS_WORDS = 'english_words_v1';
const LS_REPO = 'github_repo_path'; // "ユーザー名/リポジトリ名" 形式

// GitHub API 設定のデフォルト値
let GITHUB_CONFIG = {
    owner: 'KentoKuroda',
    repo: 'english-study',
    path: 'words.json',
};

let words = [];

// --- 認証と初期化 ---
window.addEventListener('DOMContentLoaded', async () => {
    const userInput = prompt("パスワードを入力してください:");
    if (userInput !== APP_PASSWORD) {
        alert("パスワードが違います。アクセス権がありません。");
        document.body.innerHTML = "<h1>Access Denied</h1>";
        return;
    }

    // 1. 保存されている設定（リポジトリ名など）を読み込み
    const savedRepo = localStorage.getItem(LS_REPO);
    if (savedRepo && savedRepo.includes('/')) {
        const parts = savedRepo.split('/');
        GITHUB_CONFIG.owner = parts[0];
        GITHUB_CONFIG.repo = parts[1];
    }

    // 2. タブ切り替えの設定
    initTabs();

    // 3. ローカルデータの読み込み（キャッシュとして表示）
    const localData = localStorage.getItem(LS_WORDS);
    if (localData) {
        try {
            words = JSON.parse(localData);
            renderList();
        } catch (e) { console.error("Cache load error", e); }
    }

    // 4. GitHubから最新データを取得
    await loadFromGitHub();
});

// --- GitHub 同期ロジック ---

async function loadFromGitHub() {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) {
        console.log("No token found. Open settings to connect.");
        return;
    }

    setSyncStatus('syncing', 'GitHubから取得中…');
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const res = await fetch(url, {
            headers: { 
                'Authorization': `token ${token}`
                // ここにあった 'Cache-Control' の行を削除しました
            }
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        // 日本語文字化け対策のデコード
        const content = decodeURIComponent(escape(atob(data.content)));
        const json = JSON.parse(content);
        
        words = json.words || [];
        localStorage.setItem(LS_WORDS, JSON.stringify(words));
        renderList();
        setSyncStatus('ok', '✓ 同期完了');
    } catch (e) {
        console.error(e);
        setSyncStatus('error', '✗ 同期失敗');
    }
}

async function saveToGitHub(wordsData) {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;

    setSyncStatus('syncing', 'GitHubへ保存中…');
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        
        // 最新のSHAを取得
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        const fileData = await getRes.json();
        const sha = fileData.sha;

        // データのエンコード（日本語対応）
        const content = btoa(unescape(encodeURIComponent(JSON.stringify({ words: wordsData }, null, 2))));
        
        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update via Web App", content: content, sha: sha })
        });

        if (!putRes.ok) throw new Error('Update failed');
        setSyncStatus('ok', '✓ リポジトリ更新完了');
    } catch (e) {
        console.error(e);
        setSyncStatus('error', '✗ 保存失敗');
    }
}

// --- UI操作関数 ---
// --- 検索機能の統合 ---
window.addEventListener('DOMContentLoaded', async () => {
    // パスワードチェック等の既存処理... [中略]

    // 検索入力イベントの追加
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => {
        renderList(e.target.value);
    });
});

window.saveSettings = async function() {
    const token = document.getElementById('cfg-token').value.trim();
    const repo = document.getElementById('cfg-repo').value.trim();

    if (token) localStorage.setItem(LS_TOKEN, token);
    if (repo) {
        localStorage.setItem(LS_REPO, repo);
        const parts = repo.split('/');
        GITHUB_CONFIG.owner = parts[0];
        GITHUB_CONFIG.repo = parts[1];
    }

    window.closeSettings();
    await loadFromGitHub();
};

window.openSettings = function() {
    const modal = document.getElementById('settings-modal');
    document.getElementById('cfg-token').value = localStorage.getItem(LS_TOKEN) || '';
    document.getElementById('cfg-repo').value = localStorage.getItem(LS_REPO) || `${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;
    modal.classList.add('open');
};

window.closeSettings = function() {
    document.getElementById('settings-modal').classList.remove('open');
};

function renderList(query = '') {
    const tbody = document.getElementById('word-tbody');
    const badge = document.getElementById('count-badge');
    if (!tbody) return;

    const q = query.toLowerCase().trim();
    // 検索クエリがある場合はフィルタリング
    const filteredWords = q 
        ? words.filter(w => 
            w.en.toLowerCase().includes(q) || 
            w.ja.toLowerCase().includes(q) || 
            (w.ex && w.ex.toLowerCase().includes(q))
          )
        : words;

    badge.textContent = `${filteredWords.length} 件`;
    
    if (filteredWords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-sub);">単語が見つかりません</td></tr>';
        return;
    }

    tbody.innerHTML = filteredWords.map(w => `
        <tr>
            <td><span class="status-select status-${(w.status || 'New').toLowerCase()}">${w.status || 'New'}</span></td>
            <td class="word-en"><strong>${w.en}</strong></td>
            <td class="word-ja">${w.ja}</td>
            <td class="word-ex">${w.ex || ''}</td>
            <td></td>
        </tr>
    `).reverse().join('');
}

function setSyncStatus(state, text) {
    const el = document.getElementById('sync-status');
    if (el) { el.className = 'sync-status ' + state; el.textContent = text; }
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('page-' + btn.dataset.tab).classList.add('active');
        });
    });
}

// 追加ボタンのイベント
document.getElementById('btn-save')?.addEventListener('click', async () => {
    const en = document.getElementById('inp-en').value.trim();
    const ja = document.getElementById('inp-ja').value.trim();
    const ex = document.getElementById('inp-ex').value.trim();
    
    if (!en || !ja) {
        alert("英語と日本語を入力してください。");
        return;
    }

    // 重複チェック (大文字小文字を区別しない)
    const isDuplicate = words.some(w => w.en.toLowerCase() === en.toLowerCase());
    if (isDuplicate) {
        alert(`⚠️ 「${en}」は既に登録されています。`);
        return;
    }

    const newWord = { id: Date.now().toString(36), en, ja, ex, status: 'New' };
    words.push(newWord);
    
    // 検索欄をクリアして全表示に戻す
    document.getElementById('search-input').value = '';
    renderList();
    
    localStorage.setItem(LS_WORDS, JSON.stringify(words));
    await saveToGitHub(words);
    
    document.getElementById('inp-en').value = '';
    document.getElementById('inp-ja').value = '';
    document.getElementById('inp-ex').value = '';
});