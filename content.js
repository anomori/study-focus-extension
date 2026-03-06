// content.js
console.log("Study Focus Guard: Content script loaded.");

const RELEVANCE_THRESHOLD = 0.35;
let isOverlayShowing = false;
const BLOCK_OVERLAY_ID = 'study-focus-block-overlay';

// Known distraction domains to penalize (for score calculation only)
const DISTRACTION_DOMAINS = [
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'tiktok.com', 'netflix.com', 'primevideo.com', 'hulu.com', 'nicovideo.jp'
];

// Initialize i18n
let i18nReady = false;
if (typeof I18n !== 'undefined') {
    I18n.init().then(() => {
        i18nReady = true;
        console.log("Study Focus Guard: i18n initialized in content script.");
    });
} else {
    console.warn("Study Focus Guard: I18n module not found.");
}

// 1. Check site settings (Allowlist/Blocklist)
async function checkSiteSettings() {
    try {
        console.log('[checkSiteSettings] Sending CHECK_SITE_SETTINGS message for:', window.location.href);
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_SITE_SETTINGS',
            url: window.location.href
        });
        console.log('[checkSiteSettings] Response received:', response);

        // Display debug info in page console (easier than service worker console)
        if (response.debug) {
            console.log('🔍 [Site Check Debug]');
            console.log('  Domain:', response.debug.domain);
            console.log('  Allowlist:', response.debug.allowlist);
            console.log('  Match Results:', response.debug.matches);
        }

        return response || { allowed: false, blocked: false };
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.log('Context invalidated. Stopping checks.');
            return { allowed: false, blocked: false };
        }
        console.error('[checkSiteSettings] Error:', e);
        return { allowed: false, blocked: false };
    }
}

// 2. Check for immediate blocks
async function checkImmediateBlocks() {
    try {
        const settings = await chrome.storage.local.get(['checkFeatureEnabled', 'blockFeatureEnabled']);
        const checkEnabled = settings.checkFeatureEnabled !== false;
        const blockEnabled = settings.blockFeatureEnabled !== false;

        if (!checkEnabled && !blockEnabled) {
            removeBlockOverlay();
            return;
        }

        const siteSettings = await checkSiteSettings();

        // If allowlisted, skip all checks
        if (siteSettings.allowed) {
            console.log("Site is allowlisted. Skipping all checks.");
            removeBlockOverlay();
            return;
        }

        // If blocked and block feature is enabled, show block screen
        if (siteSettings.blocked && blockEnabled) {
            // Check i18n readiness
            if (!i18nReady && typeof I18n !== 'undefined') await I18n.init();

            const title = typeof I18n !== 'undefined' ? I18n.getMessage('block_title') : "ブロック中";
            const messageTemplate = typeof I18n !== 'undefined' ? I18n.getMessage('block_message') : "{site}は勉強中にブロックされています。";
            const message = messageTemplate.replace('{site}', siteSettings.reason || 'このサイト');

            removeDistractionOverlay();
            blockContent(title, message);
            return;
        }

        removeBlockOverlay();
    } catch (e) {
        console.error("Error in checkImmediateBlocks:", e);
    }
}

checkImmediateBlocks();

// Watch for URL changes (SPA support like YouTube)
let lastUrl = location.href;
function handlePotentialUrlChange() {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        onUrlChange();
    }
}

new MutationObserver(handlePotentialUrlChange).observe(document, { subtree: true, childList: true });
window.addEventListener('popstate', handlePotentialUrlChange);
window.addEventListener('hashchange', handlePotentialUrlChange);

const originalPushState = history.pushState;
history.pushState = function (...args) {
    originalPushState.apply(this, args);
    handlePotentialUrlChange();
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    handlePotentialUrlChange();
};

async function onUrlChange() {
    try {
        const settings = await chrome.storage.local.get(['checkFeatureEnabled', 'blockFeatureEnabled']);
        const checkEnabled = settings.checkFeatureEnabled !== false;
        const blockEnabled = settings.blockFeatureEnabled !== false;

        if (!checkEnabled && !blockEnabled) {
            removeBlockOverlay();
            removeDistractionOverlay();
            return;
        }

        const siteSettings = await checkSiteSettings();

        // If allowlisted, skip all checks
        if (siteSettings.allowed) {
            console.log("Site is allowlisted. Skipping all checks.");
            removeBlockOverlay();
            removeDistractionOverlay();
            return;
        }

        // If blocked and block feature is enabled, show block screen
        if (siteSettings.blocked && blockEnabled) {
            if (!i18nReady && typeof I18n !== 'undefined') await I18n.init();

            const title = typeof I18n !== 'undefined' ? I18n.getMessage('block_title') : "ブロック中";
            const messageTemplate = typeof I18n !== 'undefined' ? I18n.getMessage('block_message') : "{site}は勉強中にブロックされています。";
            const message = messageTemplate.replace('{site}', siteSettings.reason || 'このサイト');

            removeDistractionOverlay();
            blockContent(title, message);
        } else {
            removeBlockOverlay();
            removeDistractionOverlay();
            // Clear dismiss cooldown on URL change (new page should be checked)
            dismissCooldownUntil = 0;
            if (checkEnabled) {
                checkRelevance(true); // Force check on URL change
                scheduleNextCheck(); // Reset periodic timer to 30s from now
            }
        }
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.log('Context invalidated in onUrlChange.');
            return;
        }
        console.error('Error in onUrlChange:', e);
    }
}

function blockContent(title, message) {
    // Stop video/audio playback when blocking
    document.querySelectorAll('video, audio').forEach(el => {
        try { el.pause(); el.src = ''; } catch (e) { /* ignore */ }
    });

    let container = document.getElementById(BLOCK_OVERLAY_ID);
    if (!container) {
        container = document.createElement('div');
        container.id = BLOCK_OVERLAY_ID;
        container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;color:#fff;display:flex;flex-direction:column;justify-content:center;align-items:center;z-index:999999;font-family:sans-serif;padding:24px;box-sizing:border-box;text-align:center;';

        const h1 = document.createElement('h1');
        h1.className = 'sfg-block-title';
        const p = document.createElement('p');
        p.className = 'sfg-block-message';

        container.appendChild(h1);
        container.appendChild(p);

        const mountPoint = document.body || document.documentElement;
        mountPoint.appendChild(container);
    }

    const titleEl = container.querySelector('.sfg-block-title');
    const messageEl = container.querySelector('.sfg-block-message');

    if (titleEl) {
        titleEl.textContent = '⛔ ' + title + ' ⛔';
    }
    if (messageEl) {
        messageEl.textContent = message;
    }
}

function removeBlockOverlay() {
    const blockOverlay = document.getElementById(BLOCK_OVERLAY_ID);
    if (blockOverlay) {
        blockOverlay.remove();
    }
}

// 3. Similarity Check
async function checkRelevance(force = false) {
    try {
        const now = Date.now();

        // Throttle: skip if checked too recently (unless forced by URL change)
        if (!force && lastCheckTime && (now - lastCheckTime < MIN_CHECK_GAP)) {
            console.log(`[checkRelevance] Skipping (last check was ${Math.round((now - lastCheckTime) / 1000)}s ago, min gap: ${MIN_CHECK_GAP / 1000}s)`);
            return;
        }

        // Skip if in dismiss cooldown (unless forced by URL change)
        if (!force && dismissCooldownUntil && now < dismissCooldownUntil) {
            console.log(`[checkRelevance] Skipping (dismiss cooldown, ${Math.round((dismissCooldownUntil - now) / 1000)}s remaining)`);
            return;
        }

        lastCheckTime = now;
        console.log('[checkRelevance] Starting relevance check...');

        // Check if check feature is enabled
        const settings = await chrome.storage.local.get('checkFeatureEnabled');
        console.log('[checkRelevance] Check feature enabled:', settings.checkFeatureEnabled);

        if (settings.checkFeatureEnabled === false) {
            console.log("Check feature disabled. Skipping check.");
            return;
        }

        // Check site settings
        console.log('[checkRelevance] About to call checkSiteSettings()...');
        const siteSettings = await checkSiteSettings();
        if (siteSettings.allowed) {
            console.log("Site is allowlisted. Skipping relevance check.");
            return;
        }
        if (siteSettings.blocked) return; // Already blocked

        // Get topics (new format with enabled flag)
        const data = await chrome.storage.local.get('studyTopics');
        let topicsData = data.studyTopics || [];

        // Handle old format (string array) and filter enabled topics
        let topics = [];
        if (topicsData.length > 0) {
            if (typeof topicsData[0] === 'string') {
                topics = [...topicsData];
            } else {
                topics = topicsData.filter(t => t.enabled).map(t => t.topic);
            }
        }

        // Topic Expansion Logic
        const TOPIC_EXPANSIONS = {
            "program": ["programming", "coding", "algorithm", "software", "developer", "engineering", "python", "javascript", "c#", "java", "code"],
            "プログラム": ["プログラミング", "コーディング", "アルゴリズム", "ソフトウェア", "開発", "エンジニア", "コード", "アプリ"],
            "math": ["mathematics", "calculus", "algebra", "geometry", "statistics", "physics"],
            "数学": ["算数", "計算", "幾何学", "代数", "微積分", "統計", "物理", "数式"],
            "english": ["language", "grammar", "vocabulary", "toeic", "toefl", "conversation"],
            "英語": ["英単語", "英文法", "英会話", "語学", "TOEIC", "留学"],
            "study": ["learning", "education", "course", "textbook"],
            "勉強": ["学習", "教育", "参考書", "教科書", "学び"]
        };

        if (topics.length > 0) {
            let expanded = [...topics];
            topics.forEach(t => {
                const lowerT = t.toLowerCase();
                if (TOPIC_EXPANSIONS[lowerT]) {
                    expanded.push(...TOPIC_EXPANSIONS[lowerT]);
                }
            });
            topics = [...new Set(expanded)];
            console.log("Expanded Topics:", topics);
        }

        if (topics.length === 0) {
            console.log("No enabled study topics. Skipping check.");
            return;
        }

        // Extract Context (Title + H1 + Meta Description)
        let contextText = document.title;
        let isEducationalContext = false;
        console.log("Context initialized. Educational:", isEducationalContext);

        // Special handling for YouTube to extract hidden metadata
        if (location.hostname.includes("youtube.com") || location.hostname.includes("youtu.be")) {
            try {
                const jsonLd = document.querySelector('script[type="application/ld+json"]');
                if (jsonLd) {
                    const jsonData = JSON.parse(jsonLd.innerText);
                    if (jsonData.description) {
                        contextText += " " + jsonData.description.substring(0, 500);
                    }
                    if (jsonData.genre) {
                        console.log("YouTube Genre detected:", jsonData.genre);
                        const eduGenres = ['Education', 'Science & Technology', 'Howto & Style', '教育', '科学と技術', 'ハウツーとスタイル'];
                        if (eduGenres.includes(jsonData.genre)) {
                            isEducationalContext = true;
                        }
                    }
                }
            } catch (e) {
                console.warn("Failed to parse YouTube metadata:", e);
            }
        }

        const h1 = document.querySelector('h1');
        if (h1) contextText += " " + h1.innerText;

        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) contextText += " " + metaDesc.content;

        // Truncate to avoid token limit issues
        contextText = contextText.substring(0, 1000);

        console.log("Checking relevance for:", contextText);


        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_RELEVANCE',
            data: {
                pageTitle: contextText,
                studyTopics: topics
            }
        });

        let score = response.score;
        const rawScore = response.score;
        console.log("Raw Similarity Score:", score);

        // Keyword Bonus
        const isTopicKeywordPresent = topics.some(topic =>
            contextText.toLowerCase().includes(topic.toLowerCase())
        );
        if (isTopicKeywordPresent) {
            console.log("Keyword match found! Boosting score (+0.5)");
            score += 0.5;
        }

        // Education Category Bonus (YouTube)
        if (isEducationalContext) {
            console.log("Educational content detected! Boosting score (+0.3)");
            score += 0.3;
        }

        // Apply penalty for known distraction domains
        if (DISTRACTION_DOMAINS.some(domain => location.hostname.includes(domain))) {
            console.log("Applying SNS penalty (-0.2)");
            score -= 0.2;
        }

        // Additional penalty for Twitter/X home timeline
        if (location.hostname.includes('twitter.com') || location.hostname.includes('x.com')) {
            if (location.pathname === '/home' || location.pathname === '/') {
                console.log("Applying Twitter/X home penalty (-0.15)");
                score -= 0.15;
            }
        }

        console.log("Final Score:", score);

        // Report score to background for popup display
        chrome.runtime.sendMessage({
            type: 'REPORT_SCORE',
            score: score,
            rawScore: rawScore
        }).catch(() => { }); // Silently handle context invalidation

        if (score !== undefined && score < RELEVANCE_THRESHOLD) {
            showDistractionOverlay(score);
        }

    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.log('Extension context invalidated. Stopping periodic checks.');
            stopPeriodicCheck();
            return;
        }
        console.error("Error checking relevance:", e);
    }
}

async function showDistractionOverlay(score) {
    if (document.getElementById('distraction-overlay')) return;

    if (!i18nReady && typeof I18n !== 'undefined') await I18n.init();

    isOverlayShowing = true;

    // デバッグモード設定を取得
    let isDebugMode = false;
    try {
        const data = await chrome.storage.local.get('recordingSettings');
        const settings = data.recordingSettings || {};
        isDebugMode = settings.debugMode === true;
    } catch (e) {
        // エラー時はデバッグ表示しない
    }

    // デバッグモードの場合のみスコアを表示
    let scoreTextStr = '';
    if (isDebugMode) {
        const template = typeof I18n !== 'undefined' ? I18n.getMessage('overlay_score') : '類似度スコア: {score} (判定: 低)';
        scoreTextStr = template.replace('{score}', score.toFixed(2));
    }

    const title = typeof I18n !== 'undefined' ? I18n.getMessage('overlay_title') : '⚠️ 勉強に関係ありますか？';
    const message = typeof I18n !== 'undefined' ? I18n.getMessage('overlay_message') : '登録された勉強内容と関連が薄い可能性があります。';
    const dismissText = typeof I18n !== 'undefined' ? I18n.getMessage('overlay_dismiss') : '関係ある（閉じる）';

    const overlay = document.createElement('div');
    overlay.id = 'distraction-overlay';

    const content = document.createElement('div');
    content.className = 'distraction-content';

    const h2 = document.createElement('h2');
    h2.textContent = title;
    content.appendChild(h2);

    if (scoreTextStr) {
        const scoreP = document.createElement('p');
        scoreP.textContent = scoreTextStr;
        content.appendChild(scoreP);
    }

    const msgP = document.createElement('p');
    msgP.textContent = message;
    content.appendChild(msgP);

    const dismissBtn = document.createElement('button');
    dismissBtn.id = 'dismiss-overlay';
    dismissBtn.textContent = dismissText;
    content.appendChild(dismissBtn);

    const annoying = document.createElement('div');
    annoying.className = 'annoying-element';
    annoying.textContent = '🥺';
    content.appendChild(annoying);

    overlay.appendChild(content);
    document.body.appendChild(overlay);

    dismissBtn.addEventListener('click', () => {
        overlay.remove();
        isOverlayShowing = false;

        // Set dismiss cooldown: periodic checks will be skipped for 2 minutes
        dismissCooldownUntil = Date.now() + 2 * 60 * 1000;

        // Reschedule next check after 2 minutes (replaces the 30s periodic timer)
        scheduleNextCheck(2 * 60 * 1000);

        console.log("Overlay dismissed. Next check in 2 minutes (cooldown active).");
    });
}

function removeDistractionOverlay() {
    const el = document.getElementById('distraction-overlay');
    if (el) {
        el.remove();
        isOverlayShowing = false;
    }
}

// Record patience event when leaving page with overlay showing
function recordPatienceEvent() {
    if (!isOverlayShowing) return;

    const domain = location.hostname;
    chrome.runtime.sendMessage({
        type: 'RECORD_PATIENCE',
        domain: domain
    }).catch(() => { });

    console.log("Patience event recorded for:", domain);
}

// Listen for page unload/visibility change to record patience
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isOverlayShowing) {
        recordPatienceEvent();
    }
});

window.addEventListener('beforeunload', () => {
    if (isOverlayShowing) {
        recordPatienceEvent();
    }
});

// Periodic check interval (30 seconds)
const PERIODIC_CHECK_INTERVAL = 30 * 1000; // 30 seconds
const MIN_CHECK_GAP = 10 * 1000; // Minimum gap between any two checks (10 seconds)
let periodicCheckTimeoutId = null;
let lastCheckTime = 0;
let dismissCooldownUntil = 0; // Timestamp until which checks should be skipped after overlay dismiss

function scheduleNextCheck(delay = PERIODIC_CHECK_INTERVAL) {
    // Cancel any existing scheduled check
    if (periodicCheckTimeoutId) {
        clearTimeout(periodicCheckTimeoutId);
        periodicCheckTimeoutId = null;
    }
    periodicCheckTimeoutId = setTimeout(() => {
        periodicCheckTimeoutId = null;
        // Check if context is still valid
        if (!chrome.runtime?.id) {
            console.log('Extension context invalidated. Stopping periodic check.');
            return;
        }
        console.log("Periodic check (30s interval)...");
        checkRelevance();
        // Schedule next check after this one completes
        scheduleNextCheck();
    }, delay);
}

function startPeriodicCheck() {
    if (periodicCheckTimeoutId) return; // Already scheduled
    scheduleNextCheck();
    console.log("Periodic check started (every 30 seconds).");
}

function stopPeriodicCheck() {
    if (periodicCheckTimeoutId) {
        clearTimeout(periodicCheckTimeoutId);
        periodicCheckTimeoutId = null;
        console.log("Periodic check stopped.");
    }
}

// Listen for feature toggle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_FEATURE_TOGGLED') {
        if (message.enabled) {
            console.log("Check feature enabled. Running check...");
            dismissCooldownUntil = 0; // Clear any dismiss cooldown
            checkRelevance(true);
            startPeriodicCheck();
        } else {
            console.log("Check feature disabled. Removing overlays...");
            removeDistractionOverlay();
            stopPeriodicCheck();
            dismissCooldownUntil = 0;
        }
    }

    if (message.type === 'BLOCK_FEATURE_TOGGLED') {
        if (message.enabled) {
            console.log("Block feature enabled. Running check...");
            checkImmediateBlocks();
        } else {
            console.log("Block feature disabled.");
            removeBlockOverlay();
        }
    }
});

// Run initial check after page loads and start periodic checks
setTimeout(async () => {
    try {
        const siteSettings = await checkSiteSettings();
        if (!siteSettings.allowed) {
            checkRelevance();
        }
        // Start periodic check if extension is enabled
        // Check if chrome.runtime is still valid before accessing storage
        if (!chrome.runtime?.id) {
            console.log('Extension context invalidated. Skipping initial setup.');
            return;
        }
        chrome.storage.local.get('checkFeatureEnabled', (data) => {
            // Check for context invalidation in callback
            if (chrome.runtime.lastError) {
                console.log('Extension context invalidated during storage access.');
                return;
            }
            if (!chrome.runtime?.id) {
                console.log('Extension context invalidated in callback.');
                return;
            }
            if (data && data.checkFeatureEnabled !== false) {
                startPeriodicCheck();
            }
        });
    } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
            console.log('Extension context invalidated during initial setup.');
            return;
        }
        console.error('Error in initial setup:', e);
    }
}, 2000);
