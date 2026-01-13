// popup.js

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadTopics();
    checkSystemStatus();
    loadCurrentScore();

    document.getElementById('add-btn').addEventListener('click', addTopic);
    document.getElementById('new-topic').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTopic();
    });
    document.getElementById('master-toggle').addEventListener('change', toggleExtension);
});

// ========== システムステータス ==========
function checkSystemStatus() {
    const statusEl = document.getElementById('system-status');
    statusEl.textContent = "起動中...";
    statusEl.style.color = "orange";

    chrome.runtime.sendMessage({ target: 'offscreen', type: 'CHECK_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
            statusEl.textContent = "エラー (Reopen)";
            statusEl.style.color = "red";
            console.error(chrome.runtime.lastError);
            return;
        }

        if (response && response.loaded) {
            statusEl.textContent = "準備完了 (AI Loaded)";
            statusEl.style.color = "#00ff88";
        } else if (response && response.error) {
            statusEl.textContent = "エラー: " + response.error;
            statusEl.style.color = "red";
        } else {
            statusEl.textContent = "モデル読込中...";
            statusEl.style.color = "orange";
            setTimeout(checkSystemStatus, 2000);
        }
    });
}

// ========== 拡張機能ON/OFF ==========
async function loadSettings() {
    const data = await chrome.storage.local.get('extensionEnabled');
    const enabled = data.extensionEnabled !== false; // default true
    document.getElementById('master-toggle').checked = enabled;
}

async function toggleExtension() {
    const enabled = document.getElementById('master-toggle').checked;
    await chrome.storage.local.set({ extensionEnabled: enabled });

    // 全タブに通知
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'EXTENSION_TOGGLED',
                    enabled: enabled
                }).catch(() => { });
            }
        });
    });
}

// ========== 現在のスコア取得 ==========
async function loadCurrentScore() {
    const scoreDisplay = document.getElementById('score-display');
    const scoreStatus = document.getElementById('score-status');

    try {
        // 現在のタブを取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            scoreDisplay.textContent = "---";
            scoreStatus.textContent = "タブ情報なし";
            return;
        }

        // Background経由でスコアを取得
        chrome.runtime.sendMessage({
            type: 'GET_CURRENT_SCORE',
            tabId: tab.id
        }, (response) => {
            if (chrome.runtime.lastError || !response) {
                scoreDisplay.textContent = "---";
                scoreStatus.textContent = "スコアなし";
                return;
            }

            if (response.score !== undefined) {
                const score = response.score;
                const rawScore = response.rawScore || score;
                scoreDisplay.textContent = score.toFixed(2);

                // スコアに応じてクラス変更
                scoreDisplay.className = '';
                if (score >= 0.35) {
                    scoreDisplay.classList.add('safe');
                    scoreStatus.textContent = `OK (Raw: ${rawScore.toFixed(2)})`;
                } else if (score >= 0.2) {
                    scoreDisplay.classList.add('warning');
                    scoreStatus.textContent = `注意 (Raw: ${rawScore.toFixed(2)})`;
                } else {
                    scoreDisplay.classList.add('danger');
                    scoreStatus.textContent = `ブロック (Raw: ${rawScore.toFixed(2)})`;
                }
            } else {
                scoreDisplay.textContent = "---";
                scoreStatus.textContent = response.message || "取得待ち";
            }
        });
    } catch (e) {
        console.error("Error loading score:", e);
        scoreDisplay.textContent = "---";
        scoreStatus.textContent = "エラー";
    }
}

// ========== トピック管理 ==========
async function loadTopics() {
    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];

    // 旧形式（文字列配列）から新形式への移行
    if (topics.length > 0 && typeof topics[0] === 'string') {
        topics = topics.map(t => ({ topic: t, enabled: true }));
        await chrome.storage.local.set({ studyTopics: topics });
    }

    renderTopics(topics);
}

async function addTopic() {
    const input = document.getElementById('new-topic');
    const topicName = input.value.trim();
    if (!topicName) return;

    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];

    // 旧形式対応
    if (topics.length > 0 && typeof topics[0] === 'string') {
        topics = topics.map(t => ({ topic: t, enabled: true }));
    }

    // 重複チェック
    if (!topics.some(t => t.topic === topicName)) {
        topics.push({ topic: topicName, enabled: true });
        await chrome.storage.local.set({ studyTopics: topics });
        renderTopics(topics);
        input.value = '';
    }
}

async function removeTopic(topicName) {
    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];
    topics = topics.filter(t => (typeof t === 'string' ? t : t.topic) !== topicName);
    await chrome.storage.local.set({ studyTopics: topics });
    renderTopics(topics);
}

async function toggleTopic(topicName) {
    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];

    topics = topics.map(t => {
        if (t.topic === topicName) {
            return { ...t, enabled: !t.enabled };
        }
        return t;
    });

    await chrome.storage.local.set({ studyTopics: topics });
    renderTopics(topics);
}

function renderTopics(topics) {
    const list = document.getElementById('topic-list');
    list.innerHTML = '';

    topics.forEach(item => {
        const topicName = typeof item === 'string' ? item : item.topic;
        const enabled = typeof item === 'string' ? true : item.enabled;

        const li = document.createElement('li');

        // トピック情報（トグル + 名前）
        const topicInfo = document.createElement('div');
        topicInfo.className = 'topic-info';

        // ON/OFFトグル
        const toggleLabel = document.createElement('label');
        toggleLabel.className = 'toggle-switch small';

        const toggleInput = document.createElement('input');
        toggleInput.type = 'checkbox';
        toggleInput.checked = enabled;
        toggleInput.addEventListener('change', () => toggleTopic(topicName));

        const toggleSlider = document.createElement('span');
        toggleSlider.className = 'toggle-slider';

        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(toggleSlider);

        // トピック名
        const nameSpan = document.createElement('span');
        nameSpan.className = 'topic-name' + (enabled ? '' : ' disabled');
        nameSpan.textContent = topicName;

        topicInfo.appendChild(toggleLabel);
        topicInfo.appendChild(nameSpan);

        // 削除ボタン
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '削除';
        removeBtn.className = 'remove-btn';
        removeBtn.onclick = () => removeTopic(topicName);

        li.appendChild(topicInfo);
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}
