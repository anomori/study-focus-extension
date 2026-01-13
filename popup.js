// popup.js

document.addEventListener('DOMContentLoaded', () => {
    loadTopics();
    checkSystemStatus();

    document.getElementById('add-btn').addEventListener('click', addTopic);
});

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
            statusEl.style.color = "green";
        } else if (response && response.error) {
            statusEl.textContent = "エラー: " + response.error;
            statusEl.style.color = "red";
        } else {
            statusEl.textContent = "モデル読込中...";
            statusEl.style.color = "orange";
            // Retry after 2 seconds if not loaded
            setTimeout(checkSystemStatus, 2000);
        }
    });
}

async function loadTopics() {
    const data = await chrome.storage.local.get('studyTopics');
    const topics = data.studyTopics || [];
    renderTopics(topics);
}

async function addTopic() {
    const input = document.getElementById('new-topic');
    const topic = input.value.trim();
    if (!topic) return;

    const data = await chrome.storage.local.get('studyTopics');
    const topics = data.studyTopics || [];

    if (!topics.includes(topic)) {
        topics.push(topic);
        await chrome.storage.local.set({ studyTopics: topics });
        renderTopics(topics);
        input.value = '';
    }
}

async function removeTopic(topic) {
    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];
    topics = topics.filter(t => t !== topic);
    await chrome.storage.local.set({ studyTopics: topics });
    renderTopics(topics);
}

function renderTopics(topics) {
    const list = document.getElementById('topic-list');
    list.innerHTML = '';

    topics.forEach(topic => {
        const li = document.createElement('li');
        li.textContent = topic;

        const btn = document.createElement('button');
        btn.textContent = '削除';
        btn.className = 'remove-btn';
        btn.onclick = () => removeTopic(topic);

        li.appendChild(btn);
        list.appendChild(li);
    });
}
