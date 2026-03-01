// popup.js

document.addEventListener('DOMContentLoaded', async () => {
    await I18n.init();

    loadSettings();
    loadTopics();
    checkSystemStatus();
    loadCurrentScore();
    initTimers();

    document.getElementById('add-btn').addEventListener('click', addTopic);
    document.getElementById('new-topic').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTopic();
    });
    document.getElementById('check-toggle').addEventListener('change', toggleCheckFeature);
    document.getElementById('block-toggle').addEventListener('change', toggleBlockFeature);

    // 詳細設定ボタン
    document.getElementById('open-settings').addEventListener('click', () => {
        chrome.tabs.create({ url: 'settings.html' });
    });
});

// ========== システムステータス ==========
function checkSystemStatus() {
    const statusEl = document.getElementById('system-status');
    statusEl.textContent = I18n.getMessage('system_starting');
    statusEl.style.color = "orange";

    chrome.runtime.sendMessage({ target: 'offscreen', type: 'CHECK_STATUS' }, (response) => {
        if (chrome.runtime.lastError) {
            statusEl.textContent = I18n.getMessage('system_error');
            statusEl.style.color = "red";
            console.error(chrome.runtime.lastError);
            return;
        }

        if (response && response.loaded) {
            statusEl.textContent = I18n.getMessage('system_ready');
            statusEl.style.color = "#00ff88";
        } else if (response && response.error) {
            statusEl.textContent = "Error: " + response.error;
            statusEl.style.color = "red";
        } else {
            statusEl.textContent = I18n.getMessage('system_loading_model');
            statusEl.style.color = "orange";
            setTimeout(checkSystemStatus, 2000);
        }
    });
}

// ========== 拡張機能ON/OFF ==========
async function loadSettings() {
    const data = await chrome.storage.local.get(['checkFeatureEnabled', 'blockFeatureEnabled']);
    const checkEnabled = data.checkFeatureEnabled !== false; // default true
    const blockEnabled = data.blockFeatureEnabled !== false; // default true
    document.getElementById('check-toggle').checked = checkEnabled;
    document.getElementById('block-toggle').checked = blockEnabled;

    // Enable animations after initial load
    setTimeout(() => {
        document.body.classList.remove('preload');
    }, 50);
}

async function toggleCheckFeature() {
    const enabled = document.getElementById('check-toggle').checked;
    await chrome.storage.local.set({ checkFeatureEnabled: enabled });

    // 全タブに通知
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'CHECK_FEATURE_TOGGLED',
                    enabled: enabled
                }).catch(() => { });
            }
        });
    });
}

async function toggleBlockFeature() {
    const enabled = document.getElementById('block-toggle').checked;
    await chrome.storage.local.set({ blockFeatureEnabled: enabled });

    // 全タブに通知
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'BLOCK_FEATURE_TOGGLED',
                    enabled: enabled
                }).catch(() => { });
            }
        });
    });
}

// ========== 現在のスコア取得 ==========
async function loadCurrentScore() {
    const scoreSection = document.getElementById('score-section');
    const scoreDisplay = document.getElementById('score-display');
    const scoreStatus = document.getElementById('score-status');

    try {
        // 設定を取得してデバッグモードか確認
        const settingsData = await chrome.storage.local.get('recordingSettings');
        const settings = settingsData.recordingSettings || {};
        const isDebugMode = settings.debugMode === true;

        // デバッグモードがOFFの場合はスコアセクション全体を非表示
        if (!isDebugMode) {
            scoreSection.style.display = 'none';
            return;
        }

        // デバッグモードがONの場合は表示
        scoreSection.style.display = 'block';

        // 現在のタブを取得
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            scoreDisplay.textContent = "---";
            scoreStatus.textContent = I18n.getMessage('score_no_tab');
            return;
        }

        // Background経由でスコアを取得
        const scoreResponse = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_SCORE', tabId: tab.id });

        if (chrome.runtime.lastError || !scoreResponse) {
            scoreDisplay.textContent = "---";
            scoreStatus.textContent = I18n.getMessage('score_none');
            return;
        }

        if (scoreResponse.score !== undefined) {
            const score = scoreResponse.score;
            const rawScore = scoreResponse.rawScore || score;
            scoreDisplay.textContent = score.toFixed(2);

            // スコアに応じてクラス変更
            scoreDisplay.className = '';

            let statusText = "";

            if (score >= 0.35) {
                scoreDisplay.classList.add('safe');
                statusText = I18n.getMessage('score_ok');
            } else if (score >= 0.2) {
                scoreDisplay.classList.add('warning');
                statusText = I18n.getMessage('score_warning');
            } else {
                scoreDisplay.classList.add('danger');
                statusText = I18n.getMessage('score_block');
            }

            scoreStatus.textContent = `${statusText} (Raw: ${rawScore.toFixed(2)})`;
        } else {
            scoreDisplay.textContent = "---";
            scoreStatus.textContent = scoreResponse.message || I18n.getMessage('score_waiting');
        }
    } catch (e) {
        console.error("Error loading score:", e);
        scoreDisplay.textContent = "---";
        scoreStatus.textContent = I18n.getMessage('score_error');
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

async function toggleTopic(topicName, toggleInput) {
    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];

    let newEnabled = null;
    topics = topics.map(t => {
        if (t.topic === topicName) {
            newEnabled = !t.enabled;
            return { ...t, enabled: newEnabled };
        }
        return t;
    });

    await chrome.storage.local.set({ studyTopics: topics });

    // DOM を直接更新してアニメーションを保持
    if (toggleInput && newEnabled !== null) {
        const li = toggleInput.closest('li');
        if (li) {
            const nameSpan = li.querySelector('.topic-name');
            if (nameSpan) {
                nameSpan.classList.toggle('disabled', !newEnabled);
            }
        }
    } else {
        renderTopics(topics);
    }
}

function renderTopics(topics) {
    const list = document.getElementById('topic-list');
    list.innerHTML = '';

    const removeText = I18n.getMessage('remove');

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
        toggleInput.addEventListener('change', () => toggleTopic(topicName, toggleInput));

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
        removeBtn.textContent = removeText;
        removeBtn.className = 'remove-btn';
        removeBtn.onclick = () => removeTopic(topicName);

        li.appendChild(topicInfo);
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}

// ========== タイマー機能（統合版） ==========
let timerUpdateInterval = null;

async function initTimers() {
    // モード切替
    const modeSelect = document.getElementById('timer-mode');
    modeSelect.addEventListener('change', updateTimerModeUI);

    // 前回の設定を復元
    const saved = (await chrome.storage.local.get('timerUISettings')).timerUISettings;
    if (saved) {
        if (saved.mode) document.getElementById('timer-mode').value = saved.mode;
        if (saved.preset) document.getElementById('timer-preset').value = saved.preset;
        if (saved.hours !== undefined) document.getElementById('timer-hours').value = saved.hours;
        if (saved.minutes !== undefined) document.getElementById('timer-minutes-input').value = saved.minutes;
        if (saved.checkAction) document.getElementById('timer-check-action').value = saved.checkAction;
        if (saved.blockAction) document.getElementById('timer-block-action').value = saved.blockAction;
        if (saved.repeat) document.getElementById('timer-repeat').checked = saved.repeat;
    }

    // 時刻入力のデフォルト値を現在時刻+1時間に（保存値がなければ）
    if (saved && saved.time) {
        document.getElementById('timer-time').value = saved.time;
    } else {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
        const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        document.getElementById('timer-time').value = defaultTime;
    }

    // モードUIを反映
    updateTimerModeUI();

    // セットボタン
    document.getElementById('timer-set-btn').addEventListener('click', setTimer);

    // 解除ボタン
    document.getElementById('check-timer-cancel').addEventListener('click', () => cancelTimer('check'));
    document.getElementById('block-timer-cancel').addEventListener('click', () => cancelTimer('block'));

    // 既存タイマーの表示更新
    loadTimerStatus();

    // 1秒ごとに残り時間を更新
    timerUpdateInterval = setInterval(loadTimerStatus, 1000);
}

function updateTimerModeUI() {
    const mode = document.getElementById('timer-mode').value;
    document.getElementById('timer-preset-row').style.display = mode === 'preset' ? 'flex' : 'none';
    document.getElementById('timer-duration-row').style.display = mode === 'duration' ? 'flex' : 'none';
    document.getElementById('timer-absolute-row').style.display = mode === 'absolute' ? 'flex' : 'none';

    // 繰り返しは時刻指定モードのみ表示
    const repeatLabel = document.getElementById('timer-repeat-label');
    if (mode !== 'absolute') {
        document.getElementById('timer-repeat').checked = false;
        repeatLabel.style.display = 'none';
    } else {
        repeatLabel.style.display = 'flex';
    }
}

function computeFireAt() {
    const mode = document.getElementById('timer-mode').value;

    if (mode === 'preset') {
        const minutes = parseInt(document.getElementById('timer-preset').value, 10);
        if (!minutes || minutes <= 0) return null;
        return Date.now() + minutes * 60 * 1000;
    }

    if (mode === 'duration') {
        const hours = parseInt(document.getElementById('timer-hours').value, 10) || 0;
        const mins = parseInt(document.getElementById('timer-minutes-input').value, 10) || 0;
        const totalMs = (hours * 60 + mins) * 60 * 1000;
        if (totalMs <= 0) return null;
        return Date.now() + totalMs;
    }

    if (mode === 'absolute') {
        const timeStr = document.getElementById('timer-time').value;
        if (!timeStr) return null;
        const [h, m] = timeStr.split(':').map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);
        // 過去の時刻なら翌日にする
        if (target.getTime() <= Date.now()) {
            target.setDate(target.getDate() + 1);
        }
        return target.getTime();
    }

    return null;
}

async function setTimer() {
    const fireAt = computeFireAt();
    if (!fireAt) return;

    const checkAction = document.getElementById('timer-check-action').value; // 'on', 'off', 'none'
    const blockAction = document.getElementById('timer-block-action').value; // 'on', 'off', 'none'

    // 両方未選択なら何もしない
    if (checkAction === 'none' && blockAction === 'none') return;

    const mode = document.getElementById('timer-mode').value;
    const repeat = document.getElementById('timer-repeat').checked && mode === 'absolute';
    const repeatTime = repeat ? document.getElementById('timer-time').value : null;

    // 各機能ごとにタイマーをセット
    const entries = [
        { feature: 'check', action: checkAction },
        { feature: 'block', action: blockAction }
    ];

    for (const { feature, action } of entries) {
        if (action === 'none') continue;

        const timerData = { feature, action, fireAt, repeat, repeatTime };
        const storageKey = `timer_${feature}`;
        await chrome.storage.local.set({ [storageKey]: timerData });

        await chrome.runtime.sendMessage({
            type: 'SET_TIMER',
            feature: feature,
            fireAt: fireAt
        });
    }

    await loadTimerStatus();

    // UI設定を保存（次回復元用）
    await chrome.storage.local.set({
        timerUISettings: {
            mode,
            preset: document.getElementById('timer-preset').value,
            hours: document.getElementById('timer-hours').value,
            minutes: document.getElementById('timer-minutes-input').value,
            time: document.getElementById('timer-time').value,
            checkAction,
            blockAction,
            repeat
        }
    });
}

async function cancelTimer(feature) {
    try {
        await chrome.runtime.sendMessage({
            type: 'CANCEL_TIMER',
            feature: feature
        });
        await chrome.storage.local.remove(`timer_${feature}`);
        await loadTimerStatus();
        console.log(`[Timer] Cancelled timer for ${feature}`);
    } catch (e) {
        console.error(`[Timer] Failed to cancel timer for ${feature}:`, e);
    }
}

async function loadTimerStatus() {
    // 1回のストレージアクセスで両方のタイマーデータを取得
    const data = await chrome.storage.local.get(['timer_check', 'timer_block']);

    const checkTimer = data.timer_check;
    const blockTimer = data.timer_block;
    const checkActive = checkTimer && checkTimer.fireAt > Date.now();
    const blockActive = blockTimer && blockTimer.fireAt > Date.now();

    // 各タイマーを個別に表示
    updateTimerDisplayWithFeature('check', checkTimer, I18n.getMessage('timer_feature_check'));
    updateTimerDisplayWithFeature('block', blockTimer, I18n.getMessage('timer_feature_block'));

    // 期限切れタイマーをクリーンアップ（繰り返し以外）
    if (checkTimer && checkTimer.fireAt <= Date.now() && !checkTimer.repeat) {
        await chrome.storage.local.remove('timer_check');
    }
    if (blockTimer && blockTimer.fireAt <= Date.now() && !blockTimer.repeat) {
        await chrome.storage.local.remove('timer_block');
    }

    document.getElementById('no-active-timers').style.display = (!checkActive && !blockActive) ? 'block' : 'none';
}

function updateTimerDisplayWithFeature(feature, timer, featureLabel) {
    const statusEl = document.getElementById(`${feature}-timer-status`);
    const remainingEl = document.getElementById(`${feature}-timer-remaining`);

    if (timer && timer.fireAt > Date.now()) {
        const remaining = timer.fireAt - Date.now();
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);

        let timeStr;
        if (mins >= 60) {
            const hours = Math.floor(mins / 60);
            const remMins = mins % 60;
            timeStr = `${hours}h ${remMins}m ${secs}s`;
        } else {
            timeStr = `${mins}m ${secs}s`;
        }

        const action = timer.action === 'on'
            ? I18n.getMessage('timer_action_on_past')
            : I18n.getMessage('timer_action_off_past');

        const featureAction = I18n.getMessage('timer_feature_action', {
            features: featureLabel,
            action: action
        });

        const repeatLabel = timer.repeat ? ` ${I18n.getMessage('timer_daily_repeat')}` : '';
        remainingEl.textContent = `${I18n.getMessage('timer_remaining', { time: timeStr })} → ${featureAction}${repeatLabel}`;
        statusEl.style.display = 'flex';
    } else {
        statusEl.style.display = 'none';
    }
}
