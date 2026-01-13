// content.js
console.log("Study Focus Guard: Content script loaded.");

const RELEVANCE_THRESHOLD = 0.35; // Adjusted to allow related but slightly distant topics (e.g. Algorithm vs Program)
let isChecked = false;

// Known distraction domains to penalize
const DISTRACTION_DOMAINS = [
    'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
    'tiktok.com', 'netflix.com', 'primevideo.com', 'hulu.com', 'nicovideo.jp'
];

// 1. Check for YouTube Shorts (Immediate Block)
if (window.location.href.includes("youtube.com/shorts/")) {
    blockShorts();
}

// Watch for URL changes (SPA support like YouTube)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        onUrlChange();
    }
}).observe(document, { subtree: true, childList: true });

function onUrlChange() {
    // Re-check shorts
    if (location.href.includes("youtube.com/shorts/")) {
        blockShorts();
    } else {
        // Remove overlay if we navigated away from shorts/distraction (or re-check)
        removeDistractionOverlay();
        checkRelevance();
    }
}

function blockShorts() {
    document.body.innerHTML = `
        <div style="
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #000; color: #fff; display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 999999;
            font-family: sans-serif;
        ">
            <h1>⛔ Shorts Blocked ⛔</h1>
            <p>Shorts are completely blocked during study sessions.</p>
        </div>
    `;
    // Stop video playback if possible
    const videos = document.querySelectorAll('video');
    videos.forEach(v => v.pause());
}

// 2. Similarity Check
async function checkRelevance() {
    // If it's a known distraction (Shorts), we already blocked it.
    if (location.href.includes("youtube.com/shorts/")) return;

    // Get topics
    const data = await chrome.storage.local.get('studyTopics');
    let topics = data.studyTopics || [];

    // Topic Expansion Logic (Synonyms & Related Terms)
    // Helps catch specific sub-topics even if the user only registered a broad term.
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
            // Check direct match in dictionary
            if (TOPIC_EXPANSIONS[lowerT]) {
                expanded.push(...TOPIC_EXPANSIONS[lowerT]);
            }
        });
        // Remove duplicates
        topics = [...new Set(expanded)];
        console.log("Expanded Topics:", topics);
    }

    if (topics.length === 0) {
        console.log("No study topics registered. Skipping check.");
        return;
    }

    // Extract Context (Title + H1 + Meta Description) to improve accuracy
    let contextText = document.title;
    let isEducationalContext = false;
    console.log("Context initialized. Educational:", isEducationalContext);

    // Special handling for YouTube to extract hidden metadata
    if (location.hostname.includes("youtube.com") || location.hostname.includes("youtu.be")) {
        try {
            const jsonLd = document.querySelector('script[type="application/ld+json"]');
            if (jsonLd) {
                const data = JSON.parse(jsonLd.innerText);
                if (data.description) {
                    contextText += " " + data.description.substring(0, 500);
                }
                if (data.genre) {
                    console.log("YouTube Genre detected:", data.genre);
                    const eduGenres = ['Education', 'Science & Technology', 'Howto & Style', '教育', '科学と技術', 'ハウツーとスタイル'];
                    if (eduGenres.includes(data.genre)) {
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

    // Truncate to avoid token limit issues (though rare with local model)
    contextText = contextText.substring(0, 1000);

    console.log("Checking relevance for:", contextText);

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_RELEVANCE',
            data: {
                pageTitle: contextText, // Send fuller context
                studyTopics: topics
            }
        });

        let score = response.score;
        console.log("Raw Similarity Score:", score);

        // Keyword Bonus: If topic appears in title/description, boost score significantly!
        // This ensures that if the specific word is there, it passes.
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

        console.log("Final Score:", score);

        // Show debug overlay
        showDebugScore(score, response.score); // Pass final score and raw score

        if (score !== undefined && score < RELEVANCE_THRESHOLD) {
            showDistractionOverlay(score);
        }

    } catch (e) {
        console.error("Error checking relevance:", e);
    }
}

function showDebugScore(finalScore, rawScore) {
    let debugEl = document.getElementById('debug-score-overlay');
    if (!debugEl) {
        debugEl = document.createElement('div');
        debugEl.id = 'debug-score-overlay';
        debugEl.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #0f0;
            padding: 5px 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 14px;
            z-index: 9999999;
            pointer-events: none;
        `;
        document.body.appendChild(debugEl);
    }

    const isSafe = finalScore >= RELEVANCE_THRESHOLD;
    debugEl.style.color = isSafe ? '#0f0' : '#f00';
    debugEl.innerText = `Score: ${finalScore.toFixed(2)} (Raw: ${rawScore.toFixed(2)}) ${isSafe ? 'OK' : 'BLOCK'}`;
}

function showDistractionOverlay(score) {
    if (document.getElementById('distraction-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'distraction-overlay';
    overlay.innerHTML = `
        <div class="distraction-content">
            <h2>⚠️ 勉強に関係ありますか？</h2>
            <p>類似度スコア: ${score.toFixed(2)} (判定: 低)</p>
            <p>登録された勉強内容と関連が薄い可能性があります。</p>
            <button id="dismiss-overlay">関係ある（閉じる）</button>
            <div class="annoying-element">🥺</div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('dismiss-overlay').addEventListener('click', () => {
        overlay.remove();
    });
}

function removeDistractionOverlay() {
    const el = document.getElementById('distraction-overlay');
    if (el) el.remove();
}

// Run initial check
// Wait a moment for dynamic content to load title
setTimeout(checkRelevance, 2000);
