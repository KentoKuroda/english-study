// --- 基本設定 ---
const APP_PASSWORD = '0101'; 
const LS_TOKEN = 'github_token';
const LS_WORDS = 'english_words_v1';
const LS_REPO = 'github_repo_path';

let GITHUB_CONFIG = {
    owner: 'KentoKuroda',
    repo: 'english-study',
    path: 'words.json',
};

let words = [];
// 学習モード用の変数
let deck = [];
let deckIdx = 0;
let correctCount = 0;
let wrongCount = 0;

// --- 認証と初期化 ---
window.addEventListener('DOMContentLoaded', async () => {
    const userInput = prompt("パスワードを入力してください:");
    if (userInput !== APP_PASSWORD) {
        alert("パスワードが違います。アクセス権がありません。");
        document.body.innerHTML = "<h1>Access Denied</h1>";
        return;
    }

    const savedRepo = localStorage.getItem(LS_REPO);
    if (savedRepo && savedRepo.includes('/')) {
        const parts = savedRepo.split('/');
        GITHUB_CONFIG.owner = parts[0];
        GITHUB_CONFIG.repo = parts[1];
    }

    initTabs();
    
    // 検索入力イベント
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        renderList(e.target.value);
    });

    // 学習開始ボタン
    document.getElementById('btn-start')?.addEventListener('click', startStudy);

    const localData = localStorage.getItem(LS_WORDS);
    if (localData) {
        try {
            words = JSON.parse(localData);
            renderList();
        } catch (e) { console.error("Cache load error", e); }
    }

    await loadFromGitHub();
});

// --- 学習モードのロジック ---

function startStudy() {
    const selectedStatuses = Array.from(document.querySelectorAll('input[name="status-filter"]:checked')).map(cb => cb.value);
    deck = words.filter(w => selectedStatuses.includes(w.status || 'New'));
    
    if (deck.length === 0) {
        alert("対象となる単語がありません。");
        return;
    }

    // シャッフル
    deck.sort(() => Math.random() - 0.5);
    deckIdx = 0;
    correctCount = 0;
    wrongCount = 0;

    document.getElementById('study-setup').style.display = 'none';
    document.getElementById('study-result').style.display = 'none';
    document.getElementById('study-card').style.display = 'block';
    showCard();
}

function showCard() {
    const word = deck[deckIdx];
    const mode = document.querySelector('input[name="mode"]:checked').value;

    // ★重要：次の問題に行く前にカードを表面に強制リセット（チラ見え防止）
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');

    // テキストの更新（カードが表を向いている間に裏面を書き換える）
    if (mode === 'en-ja') {
        document.getElementById('front-label').textContent = 'English';
        document.getElementById('front-word').textContent = word.en;
        document.getElementById('back-label').textContent = '日本語';
        document.getElementById('back-word').textContent = word.ja;
    } else {
        document.getElementById('front-label').textContent = '日本語';
        document.getElementById('front-word').textContent = word.ja;
        document.getElementById('back-label').textContent = 'English';
        document.getElementById('back-word').textContent = word.en;
    }
    document.getElementById('back-example').textContent = word.ex || '';

    // 進捗表示
    const progress = ((deckIdx + 1) / deck.length) * 100;
    document.getElementById('progress-bar').style.width = progress + '%';
    document.getElementById('progress-text').textContent = `${deckIdx + 1} / ${deck.length}`;

    document.getElementById('fc-flip-hint').style.display = '';
    document.getElementById('fc-controls').style.display = 'none';
}

window.flipCard = function() {
    document.getElementById('flashcard').classList.add('flipped');
    document.getElementById('fc-flip-hint').style.display = 'none';
    document.getElementById('fc-controls').style.display = 'flex';
};

window.answer = function(correct) {
    if (correct) correctCount++; else wrongCount++;
    deckIdx++;
    if (deckIdx >= deck.length) showResult(); else showCard();
};

function showResult() {
    document.getElementById('study-card').style.display = 'none';
    document.getElementById('study-result').style.display = 'block';
    const total = deck.length;
    const pct = Math.round((correctCount / total) * 100);
    document.getElementById('result-score').textContent = pct + '%';
    document.getElementById('res-correct').textContent = correctCount;
    document.getElementById('res-wrong').textContent = wrongCount;
    document.getElementById('res-total').textContent = total;
}

window.backToSetup = function() {
    document.getElementById('study-result').style.display = 'none';
    document.getElementById('study-setup').style.display = 'block';
};

// --- GitHub 同期・UI操作ロジック [既存のものを維持] ---

async function loadFromGitHub() {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;
    setSyncStatus('syncing', 'GitHubから取得中…');
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const res = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content)));
        words = JSON.parse(content).words || [];
        localStorage.setItem(LS_WORDS, JSON.stringify(words));
        renderList();
        setSyncStatus('ok', '✓ 同期完了');
    } catch (e) { setSyncStatus('error', '✗ 同期失敗'); }
}

async function saveToGitHub(wordsData) {
    const token = localStorage.getItem(LS_TOKEN);
    if (!token) return;
    setSyncStatus('syncing', 'GitHubへ保存中…');
    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify({ words: wordsData }, null, 2))));
        await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update via Web App", content: content, sha: fileData.sha })
        });
        setSyncStatus('ok', '✓ リポジトリ更新完了');
    } catch (e) { setSyncStatus('error', '✗ 保存失敗'); }
}

function renderList(query = '') {
    const tbody = document.getElementById('word-tbody');
    const badge = document.getElementById('count-badge');
    if (!tbody) return;
    const q = query.toLowerCase().trim();
    const filteredWords = q ? words.filter(w => w.en.toLowerCase().includes(q) || w.ja.toLowerCase().includes(q)) : words;
    badge.textContent = `${filteredWords.length} 件`;
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

window.saveSettings = async function() {
    const token = document.getElementById('cfg-token').value.trim();
    const repo = document.getElementById('cfg-repo').value.trim();
    if (token) localStorage.setItem(LS_TOKEN, token);
    if (repo) localStorage.setItem(LS_REPO, repo);
    window.closeSettings();
    location.reload(); // 設定反映のためリロード
};

window.openSettings = function() {
    document.getElementById('settings-modal').classList.add('open');
    document.getElementById('cfg-token').value = localStorage.getItem(LS_TOKEN) || '';
    document.getElementById('cfg-repo').value = localStorage.getItem(LS_REPO) || '';
};

window.closeSettings = function() { document.getElementById('settings-modal').classList.remove('open'); };

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

document.getElementById('btn-save')?.addEventListener('click', async () => {
    const en = document.getElementById('inp-en').value.trim();
    const ja = document.getElementById('inp-ja').value.trim();
    const ex = document.getElementById('inp-ex').value.trim();
    if (!en || !ja) return;
    if (words.some(w => w.en.toLowerCase() === en.toLowerCase())) {
        alert(`⚠️ 「${en}」は既に登録されています。`);
        return;
    }
    const newWord = { id: Date.now().toString(36), en, ja, ex, status: 'New' };
    words.push(newWord);
    renderList();
    localStorage.setItem(LS_WORDS, JSON.stringify(words));
    await saveToGitHub(words);
    document.getElementById('inp-en').value = '';
    document.getElementById('inp-ja').value = '';
    document.getElementById('inp-ex').value = '';
});