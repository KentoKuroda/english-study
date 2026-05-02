// --- GitHub API 設定 (必ず自分の情報に書き換えてください) ---
const GITHUB_CONFIG = {
    owner: 'KentoKuroda', // GitHubのユーザー名
    repo: 'english-study',  // リポジトリ名
    path: 'words.json',      // 保存するファイル名
};

// --- 設定キー ---
const LS_TOKEN = 'github_token';
const LS_WORDS = 'english_words_v1';

// --- 状態管理 ---
let words = [];
let editingId = null;
let syncTimer = null;

// --- 初期化処理 ---
window.onload = async () => {
    // 1. ローカルキャッシュがあれば先に表示（体感速度アップ）
    const localData = localStorage.getItem(LS_WORDS);
    if (localData) {
        words = JSON.parse(localData);
        renderList();
    }
    // 2. GitHubから最新データを取得
    await loadFromGitHub();
};

// --- GitHubから読み込み ---
async function loadFromGitHub() {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;

    setSyncStatus('syncing', 'GitHubから同期中…');
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
            headers: { 'Authorization': `token ${token}`, 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) throw new Error(`読み込み失敗: ${res.status}`);
        
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content))); // Base64デコード（日本語対応）
        const json = JSON.parse(content);
        
        words = json.words || [];
        localStorage.setItem(LS_WORDS, JSON.stringify(words)); // キャッシュ更新
        renderList();
        setSyncStatus('ok', '✓ GitHub同期済み');
    } catch (e) {
        console.error(e);
        setSyncStatus('error', '✗ 同期失敗');
    }
}

// --- GitHubへ保存 ---
async function saveToGitHub(wordsData) {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;

    setSyncStatus('syncing', 'GitHubへ保存中…');
    try {
        // 1. 現在のファイルのSHAを取得
        const getRes = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const fileData = await getRes.json();
        const sha = fileData.sha;

        // 2. データを更新
        const content = b64EncodeUnicode(JSON.stringify({ words: wordsData }, null, 2));
        const putRes = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Update words via App",
                content: content,
                sha: sha
            })
        });

        if (!putRes.ok) throw new Error('保存失敗');
        setSyncStatus('ok', '✓ GitHub保存完了');
    } catch (e) {
        console.error(e);
        setSyncStatus('error', '✗ 保存失敗');
    }
}

// 日本語対応のBase64エンコード
function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
}

// --- 同期状態の表示 ---
function setSyncStatus(state, text) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.className = 'sync-status ' + state;
    el.textContent = text;
}

// --- 設定保存 (PAT入力時) ---
function saveSettings() {
    const token = document.getElementById('cfg-token').value.trim();
    if (token) {
        localStorage.setItem(LS_TOKEN, token);
        closeSettings();
        loadFromGitHub(); // 即座に同期
    }
}

// --- データ保存処理 (保存ボタン押下時) ---
document.getElementById('btn-save').addEventListener('click', () => {
    const en = document.getElementById('inp-en').value.trim();
    const ja = document.getElementById('inp-ja').value.trim();
    const ex = document.getElementById('inp-ex').value.trim();
    if (!en || !ja) return;

    if (editingId) {
        const idx = words.findIndex(w => w.id === editingId);
        if (idx !== -1) words[idx] = { ...words[idx], en, ja, ex };
        editingId = null;
    } else {
        words.push({ id: Date.now().toString(36), en, ja, ex, status: 'New' });
    }

    renderList();
    localStorage.setItem(LS_WORDS, JSON.stringify(words));
    saveToGitHub(words); // GitHubへ送信
    
    // フォームクリア
    document.getElementById('inp-en').value = '';
    document.getElementById('inp-ja').value = '';
    document.getElementById('inp-ex').value = '';
});

// --- リスト表示処理 ---
function renderList() {
    const tbody = document.getElementById('word-tbody');
    const badge = document.getElementById('count-badge');
    if (!tbody) return;

    badge.textContent = `${words.length} 件`;
    tbody.innerHTML = words.map(w => `
        <tr>
            <td><span class="status-new">${w.status || 'New'}</span></td>
            <td><div class="word-en">${w.en}</div></td>
            <td><div class="word-ja">${w.ja}</div></td>
            <td><div class="word-ex">${w.ex || ''}</div></td>
            <td></td>
        </tr>
    `).reverse().join('');
}

// モーダル管理関数
function openSettings() { document.getElementById('settings-modal').classList.add('open'); }
function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }