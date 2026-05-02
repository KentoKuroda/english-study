// --- GitHub API 設定 ---
const GITHUB_CONFIG = {
    owner: 'YOUR_USERNAME', // あなたのユーザー名
    repo: 'YOUR_REPO_NAME',  // リポジトリ名
    path: 'words.json',      // 保存するファイル名
  };
  
  async function saveToGitHub(wordsData) {
    const token = localStorage.getItem('github_token'); // 設定で保存しておく
    if (!token) return;
  
    setSyncStatus('syncing', 'GitHubへ保存中…');
  
    try {
      // 1. 現在のファイルのSHA（バージョン情報）を取得
      const getRes = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
        headers: { 'Authorization': `token ${token}` }
      });
      const fileData = await getRes.json();
      const sha = fileData.sha;
  
      // 2. データを更新（Base64エンコードが必要）
      const content = b64EncodeUnicode(JSON.stringify({ words: wordsData }, null, 2));
      
      const putRes = await fetch(`https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "Update word list via Web UI",
          content: content,
          sha: sha
        })
      });
  
      if (!putRes.ok) throw new Error('GitHubの更新に失敗しました');
      setSyncStatus('ok', '✓ GitHub同期完了');
    } catch (e) {
      console.error(e);
      setSyncStatus('error', '✗ 同期失敗');
    }
  }
  
  // 日本語（Unicode）を壊さずにBase64エンコードする関数
  function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
      return String.fromCharCode('0x' + p1);
    }));
  }