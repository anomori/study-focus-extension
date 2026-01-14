// statistics-storage.js
// 統計データと設定の保存・取得・削除を管理するモジュール

const StatisticsStorage = {
    // ========== デフォルト設定 ==========
    DEFAULT_RECORDING_SETTINGS: {
        enabled: false,                // 記録機能全体のON/OFF
        recordPatienceCount: false,    // 我慢回数を記録
        recordBrowsingTime: false,     // 閲覧サイト・時間を記録
        recordSnsTimeOnly: false,      // SNSの時間だけ記録（browsingTimeがfalseの時のみ有効）
        hasShownInitialPrompt: false,  // 初回確認ダイアログ表示済みか
        timezoneMode: 'auto',          // タイムゾーン設定 (auto, region, manual)
        timezoneRegion: '',            // 地域名 (例: Asia/Tokyo)
        timezoneManual: '',            // 手動オフセット (例: +09:00)
        debugMode: false               // デバッグ情報をポップアップに表示
    },

    DEFAULT_SITE_SETTINGS: {
        allowlist: [],  // 許可サイト（スコア測定・警告なし）
        blocklist: [    // 禁止サイト（デフォルト）
            'instagram.com',
            'www.instagram.com'
        ],
        blockedPatterns: [  // URLパターンで禁止（YouTube Shortsなど）
            { domain: 'youtube.com', pathPattern: '/shorts' },
            { domain: 'www.youtube.com', pathPattern: '/shorts' }
        ]
    },

    // SNSドメインリスト（SNSのみ記録用）
    SNS_DOMAINS: [
        'twitter.com', 'x.com', 'facebook.com', 'instagram.com',
        'tiktok.com', 'threads.net', 'reddit.com'
    ],

    // ========== 記録設定 ==========
    async getRecordingSettings() {
        const data = await chrome.storage.local.get('recordingSettings');
        return { ...this.DEFAULT_RECORDING_SETTINGS, ...data.recordingSettings };
    },

    async saveRecordingSettings(settings) {
        await chrome.storage.local.set({ recordingSettings: settings });
    },

    // ========== サイト設定 ==========
    async getSiteSettings() {
        const data = await chrome.storage.local.get('siteSettings');
        return { ...this.DEFAULT_SITE_SETTINGS, ...data.siteSettings };
    },

    async saveSiteSettings(settings) {
        await chrome.storage.local.set({ siteSettings: settings });
    },

    // ========== サイト判定 ==========
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            return null;
        }
    },

    async isAllowlisted(url) {
        const domain = this.extractDomain(url);
        if (!domain) return false;

        const settings = await this.getSiteSettings();
        return settings.allowlist.some(allowed =>
            domain === allowed || domain === 'www.' + allowed ||
            allowed === domain || allowed === 'www.' + domain
        );
    },

    async isBlocked(url) {
        const domain = this.extractDomain(url);
        if (!domain) return { blocked: false };

        const settings = await this.getSiteSettings();

        // パターンマッチ（YouTube Shortsなど）
        try {
            const urlObj = new URL(url);
            for (const pattern of settings.blockedPatterns) {
                const patternDomain = pattern.domain.replace(/^www\./, '');
                if ((domain === patternDomain || domain === 'www.' + patternDomain) &&
                    urlObj.pathname.startsWith(pattern.pathPattern)) {
                    return { blocked: true, reason: `${pattern.domain}${pattern.pathPattern}` };
                }
            }
        } catch { }

        // ドメインブロック
        for (const blocked of settings.blocklist) {
            const blockedDomain = blocked.replace(/^www\./, '');
            if (domain === blockedDomain || domain === 'www.' + blockedDomain) {
                return { blocked: true, reason: blocked };
            }
        }

        return { blocked: false };
    },

    isSNSDomain(url) {
        const domain = this.extractDomain(url);
        if (!domain) return false;
        return this.SNS_DOMAINS.some(sns =>
            domain === sns || domain === 'www.' + sns
        );
    },

    // ========== データ記録 ==========
    async shouldRecordBrowsing(url) {
        const settings = await this.getRecordingSettings();
        if (!settings.enabled) return false;
        if (settings.recordBrowsingTime) return true;
        if (settings.recordSnsTimeOnly && this.isSNSDomain(url)) return true;
        return false;
    },

    async recordPatienceEvent(domain) {
        const settings = await this.getRecordingSettings();
        if (!settings.enabled || !settings.recordPatienceCount) return;

        const timestamp = Date.now();
        // 記録は常にUTCで行う（表示時にタイムゾーン変換）
        const date = new Date(timestamp).toISOString().split('T')[0];

        const data = await chrome.storage.local.get('stats_patience');
        const events = data.stats_patience || [];

        events.push({ domain, timestamp, date });
        await chrome.storage.local.set({ stats_patience: events });
    },

    async recordBrowsingSession(domain, startTime, endTime, isBlockingEnabled) {
        const url = 'https://' + domain;
        if (!(await this.shouldRecordBrowsing(url))) return;

        const duration = endTime - startTime;
        if (duration < 1000) return; // 1秒未満は記録しない

        // 記録は常にUTCで行う
        const date = new Date(startTime).toISOString().split('T')[0];
        const hour = new Date(startTime).getUTCHours();

        const data = await chrome.storage.local.get('stats_browsing');
        const sessions = data.stats_browsing || [];

        sessions.push({
            domain,
            startTime,
            endTime,
            duration,
            isBlockingEnabled,
            date,
            hour
        });

        await chrome.storage.local.set({ stats_browsing: sessions });
    },

    // ========== 統計取得 ==========
    // ========== 統計取得 ==========
    async getStatistics(startDate, endDate, options = {}) {
        const { groupBy = 'day', filterBlocking = null, timezone = 'UTC' } = options;

        const patienceData = await chrome.storage.local.get('stats_patience');
        const browsingData = await chrome.storage.local.get('stats_browsing');

        let patienceEvents = patienceData.stats_patience || [];
        let browsingSessions = browsingData.stats_browsing || [];

        // ブロッキング状態フィルター
        if (filterBlocking !== null) {
            browsingSessions = browsingSessions.filter(s => s.isBlockingEnabled === filterBlocking);
        }

        // タイムゾーンを考慮して日付フィルターとグループ化を行う
        const stats = {
            patience: this.groupPatienceEvents(patienceEvents, groupBy, timezone, startDate, endDate),
            browsing: this.groupBrowsingSessions(browsingSessions, groupBy, timezone, startDate, endDate),
            totals: {
                patienceCount: 0,
                totalBrowsingTime: 0,
                browsingByDomain: []
            }
        };

        // 合計値の計算
        let totalTime = 0;
        Object.values(stats.browsing).forEach(group => totalTime += group.totalTime);
        stats.totals.totalBrowsingTime = totalTime;

        let totalPatience = 0;
        Object.values(stats.patience).forEach(group => totalPatience += group.count);
        stats.totals.patienceCount = totalPatience;

        // ドメイン別集計（フィルタリング後のセッションから）
        const filteredSessions = this.filterSessionsByDate(browsingSessions, startDate, endDate, timezone);
        stats.totals.browsingByDomain = this.aggregateByDomain(filteredSessions);

        return stats;
    },

    // タイムゾーン考慮の日付文字列取得
    getDateStringInTimezone(timestamp, timezone) {
        try {
            if (/^[+-]\d{2}:\d{2}$/.test(timezone)) {
                const date = new Date(timestamp);
                const offsetMatches = timezone.match(/([+-])(\d{2}):(\d{2})/);
                const sign = offsetMatches[1] === '+' ? 1 : -1;
                const hours = parseInt(offsetMatches[2], 10);
                const minutes = parseInt(offsetMatches[3], 10);
                const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

                const localDate = new Date(date.getTime() + offsetMs);
                return localDate.toISOString().split('T')[0];
            }

            // For IANA timezones, we construct YYYY-MM-DD manually to ensure correct format
            const formatter = new Intl.DateTimeFormat('ja-JP', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const parts = formatter.formatToParts(new Date(timestamp));
            const year = parts.find(p => p.type === 'year').value;
            const month = parts.find(p => p.type === 'month').value;
            const day = parts.find(p => p.type === 'day').value;
            return `${year}-${month}-${day}`;
        } catch (e) {
            console.error('Invalid timezone:', timezone, e);
            return new Date(timestamp).toISOString().split('T')[0]; // Fallback to UTC
        }
    },

    filterSessionsByDate(sessions, startDate, endDate, timezone) {
        if (!startDate && !endDate) return sessions;

        return sessions.filter(session => {
            const date = this.getDateStringInTimezone(session.startTime, timezone);
            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;
            return true;
        });
    },

    groupPatienceEvents(events, groupBy, timezone, startDate, endDate) {
        const grouped = {};

        events.forEach(event => {
            const dateInTz = this.getDateStringInTimezone(event.timestamp, timezone);

            if (startDate && dateInTz < startDate) return;
            if (endDate && dateInTz > endDate) return;

            let key;

            if (groupBy === 'month') {
                key = dateInTz.substring(0, 7); // YYYY-MM
            } else if (groupBy === 'hour') {
                const d = new Date(event.timestamp);
                let hour;
                if (/^[+-]\d{2}:\d{2}$/.test(timezone)) {
                    const offsetMatches = timezone.match(/([+-])(\d{2}):(\d{2})/);
                    const sign = offsetMatches[1] === '+' ? 1 : -1;
                    const offsetMs = sign * (parseInt(offsetMatches[2]) * 60 + parseInt(offsetMatches[3])) * 60 * 1000;
                    hour = new Date(d.getTime() + offsetMs).getUTCHours();
                } else {
                    try {
                        hour = parseInt(new Intl.DateTimeFormat('ja-JP', {
                            timeZone: timezone, hour: 'numeric', hour12: false
                        }).format(d));
                    } catch (e) { hour = d.getUTCHours(); }
                }
                key = `${dateInTz}-${String(hour).padStart(2, '0')}`;
            } else {
                key = dateInTz; // YYYY-MM-DD
            }

            if (!grouped[key]) {
                grouped[key] = { count: 0, domains: {} };
            }
            grouped[key].count++;
            grouped[key].domains[event.domain] = (grouped[key].domains[event.domain] || 0) + 1;
        });

        return grouped;
    },
    groupBrowsingSessions(sessions, groupBy, timezone, startDate, endDate) {
        const grouped = {};

        sessions.forEach(session => {
            const dateInTz = this.getDateStringInTimezone(session.startTime, timezone);

            if (startDate && dateInTz < startDate) return;
            if (endDate && dateInTz > endDate) return;

            let key;

            if (groupBy === 'month') {
                key = dateInTz.substring(0, 7);
            } else if (groupBy === 'hour') {
                const d = new Date(session.startTime);
                let hour;
                if (/^[+-]\d{2}:\d{2}$/.test(timezone)) {
                    const offsetMatches = timezone.match(/([+-])(\d{2}):(\d{2})/);
                    const sign = offsetMatches[1] === '+' ? 1 : -1;
                    const offsetMs = sign * (parseInt(offsetMatches[2]) * 60 + parseInt(offsetMatches[3])) * 60 * 1000;
                    hour = new Date(d.getTime() + offsetMs).getUTCHours();
                } else {
                    try {
                        hour = parseInt(new Intl.DateTimeFormat('ja-JP', {
                            timeZone: timezone, hour: 'numeric', hour12: false
                        }).format(d));
                    } catch (e) { hour = d.getUTCHours(); }
                }
                key = `${dateInTz}-${String(hour).padStart(2, '0')}`;
            } else {
                key = dateInTz;
            }

            if (!grouped[key]) {
                grouped[key] = { totalTime: 0, domains: {} };
            }
            grouped[key].totalTime += session.duration;
            grouped[key].domains[session.domain] =
                (grouped[key].domains[session.domain] || 0) + session.duration;
        });

        return grouped;
    },

    aggregateByDomain(sessions) {
        const byDomain = {};
        sessions.forEach(session => {
            byDomain[session.domain] = (byDomain[session.domain] || 0) + session.duration;
        });

        // 使用時間順にソート
        return Object.entries(byDomain)
            .sort((a, b) => b[1] - a[1])
            .map(([domain, time]) => ({ domain, time }));
    },

    // ========== データ削除 ==========
    async deleteDataInRange(startDate, endDate) {
        const patienceData = await chrome.storage.local.get('stats_patience');
        const browsingData = await chrome.storage.local.get('stats_browsing');

        let patienceEvents = patienceData.stats_patience || [];
        let browsingSessions = browsingData.stats_browsing || [];

        // 範囲外のデータのみ保持
        patienceEvents = patienceEvents.filter(e =>
            e.date < startDate || e.date > endDate
        );
        browsingSessions = browsingSessions.filter(s =>
            s.date < startDate || s.date > endDate
        );

        await chrome.storage.local.set({
            stats_patience: patienceEvents,
            stats_browsing: browsingSessions
        });

        return {
            deletedPatienceCount: (patienceData.stats_patience || []).length - patienceEvents.length,
            deletedBrowsingCount: (browsingData.stats_browsing || []).length - browsingSessions.length
        };
    },

    async deleteAllData() {
        await chrome.storage.local.remove(['stats_patience', 'stats_browsing']);
    },

    // ========== ユーティリティ ==========
    getDateString(timestamp) {
        // Default to UTC for internal storage / fallback
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    },

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}時間${minutes % 60}分`;
        } else if (minutes > 0) {
            return `${minutes}分`;
        } else {
            return `${seconds}秒`;
        }
    },

    // ========== 許可・禁止サイト管理 ==========
    async addToAllowlist(domain) {
        const settings = await this.getSiteSettings();
        const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

        if (!settings.allowlist.includes(normalizedDomain)) {
            settings.allowlist.push(normalizedDomain);
            await this.saveSiteSettings(settings);
        }
    },

    async removeFromAllowlist(domain) {
        const settings = await this.getSiteSettings();
        const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

        settings.allowlist = settings.allowlist.filter(d => d !== normalizedDomain);
        await this.saveSiteSettings(settings);
    },

    async addToBlocklist(domain) {
        const settings = await this.getSiteSettings();
        const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

        if (!settings.blocklist.includes(normalizedDomain)) {
            settings.blocklist.push(normalizedDomain);
            await this.saveSiteSettings(settings);
        }
    },

    async removeFromBlocklist(domain) {
        const settings = await this.getSiteSettings();
        const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

        settings.blocklist = settings.blocklist.filter(d => d !== normalizedDomain);
        await this.saveSiteSettings(settings);
    },

    async addBlockedPattern(domain, pathPattern) {
        const settings = await this.getSiteSettings();
        const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

        const exists = settings.blockedPatterns.some(p =>
            p.domain.replace(/^www\./, '').toLowerCase() === normalizedDomain &&
            p.pathPattern === pathPattern
        );

        if (!exists) {
            settings.blockedPatterns.push({ domain: normalizedDomain, pathPattern });
            await this.saveSiteSettings(settings);
        }
    },

    async removeBlockedPattern(domain, pathPattern) {
        const settings = await this.getSiteSettings();
        const normalizedDomain = domain.replace(/^www\./, '').toLowerCase();

        settings.blockedPatterns = settings.blockedPatterns.filter(p =>
            !(p.domain.replace(/^www\./, '').toLowerCase() === normalizedDomain &&
                p.pathPattern === pathPattern)
        );
        await this.saveSiteSettings(settings);
    },

    // ========== エクスポート/インポート ==========
    async exportAllData(options = {}) {
        const { startDate, endDate, includePatience = true, includeBrowsing = true, includeSettings = true } = options;

        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            dateRange: { startDate: startDate || 'all', endDate: endDate || 'all' }
        };

        // 統計データを取得
        const patienceData = await chrome.storage.local.get('stats_patience');
        const browsingData = await chrome.storage.local.get('stats_browsing');

        let patienceEvents = patienceData.stats_patience || [];
        let browsingSessions = browsingData.stats_browsing || [];

        // 日付フィルター
        if (startDate) {
            patienceEvents = patienceEvents.filter(e => e.date >= startDate);
            browsingSessions = browsingSessions.filter(s => s.date >= startDate);
        }
        if (endDate) {
            patienceEvents = patienceEvents.filter(e => e.date <= endDate);
            browsingSessions = browsingSessions.filter(s => s.date <= endDate);
        }

        if (includePatience) {
            exportData.patienceEvents = patienceEvents;
        }
        if (includeBrowsing) {
            exportData.browsingSessions = browsingSessions;
        }
        if (includeSettings) {
            exportData.recordingSettings = await this.getRecordingSettings();
            exportData.siteSettings = await this.getSiteSettings();

            // 勉強項目も含める
            const studyData = await chrome.storage.local.get('studyTopics');
            exportData.studyTopics = studyData.studyTopics || [];
        }

        return exportData;
    },

    async importData(data, mode = 'merge') {
        const results = {
            patienceImported: 0,
            browsingImported: 0,
            settingsImported: false,
            studyTopicsImported: 0
        };

        // 我慢回数データ
        if (data.patienceEvents) {
            if (mode === 'replace') {
                await chrome.storage.local.set({ stats_patience: data.patienceEvents });
                results.patienceImported = data.patienceEvents.length;
            } else {
                const existing = await chrome.storage.local.get('stats_patience');
                const existingEvents = existing.stats_patience || [];

                // 重複を避けてマージ（timestampで判定）
                const existingTimestamps = new Set(existingEvents.map(e => e.timestamp));
                const newEvents = data.patienceEvents.filter(e => !existingTimestamps.has(e.timestamp));

                await chrome.storage.local.set({
                    stats_patience: [...existingEvents, ...newEvents]
                });
                results.patienceImported = newEvents.length;
            }
        }

        // 閲覧時間データ
        if (data.browsingSessions) {
            if (mode === 'replace') {
                await chrome.storage.local.set({ stats_browsing: data.browsingSessions });
                results.browsingImported = data.browsingSessions.length;
            } else {
                const existing = await chrome.storage.local.get('stats_browsing');
                const existingSessions = existing.stats_browsing || [];

                // 重複を避けてマージ（startTimeで判定）
                const existingStartTimes = new Set(existingSessions.map(s => s.startTime));
                const newSessions = data.browsingSessions.filter(s => !existingStartTimes.has(s.startTime));

                await chrome.storage.local.set({
                    stats_browsing: [...existingSessions, ...newSessions]
                });
                results.browsingImported = newSessions.length;
            }
        }

        // 設定データ
        if (data.recordingSettings) {
            await this.saveRecordingSettings(data.recordingSettings);
            results.settingsImported = true;
        }
        if (data.siteSettings) {
            await this.saveSiteSettings(data.siteSettings);
            results.settingsImported = true;
        }

        // 勉強項目
        if (data.studyTopics) {
            if (mode === 'replace') {
                await chrome.storage.local.set({ studyTopics: data.studyTopics });
                results.studyTopicsImported = data.studyTopics.length;
            } else {
                const existing = await chrome.storage.local.get('studyTopics');
                const existingTopics = existing.studyTopics || [];

                // 重複を避けてマージ（textで判定）
                const existingTexts = new Set(existingTopics.map(t => t.text));
                const newTopics = data.studyTopics.filter(t => !existingTexts.has(t.text));

                await chrome.storage.local.set({
                    studyTopics: [...existingTopics, ...newTopics]
                });
                results.studyTopicsImported = newTopics.length;
            }
        }

        return results;
    },

    async exportBrowsingToCSV(startDate, endDate) {
        const browsingData = await chrome.storage.local.get('stats_browsing');
        let sessions = browsingData.stats_browsing || [];

        // 日付フィルター
        if (startDate) {
            sessions = sessions.filter(s => s.date >= startDate);
        }
        if (endDate) {
            sessions = sessions.filter(s => s.date <= endDate);
        }

        if (sessions.length === 0) {
            return '日付,ドメイン,閲覧時間(分),判定機能\n';
        }

        // ピボットテーブル形式: 日付, ドメイン, 閲覧時間(分), 判定機能
        const rows = [['日付', 'ドメイン', '閲覧時間(分)', '判定機能']];

        // 日付・ドメイン・判定機能でグループ化
        const grouped = {};
        sessions.forEach(session => {
            const key = `${session.date}|${session.domain}|${session.isBlockingEnabled ? 'ON' : 'OFF'}`;
            if (!grouped[key]) {
                grouped[key] = {
                    date: session.date,
                    domain: session.domain,
                    isBlockingEnabled: session.isBlockingEnabled,
                    totalTime: 0
                };
            }
            grouped[key].totalTime += session.duration;
        });

        // 日付順にソート
        const sortedEntries = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

        sortedEntries.forEach(entry => {
            const minutes = Math.round(entry.totalTime / 1000 / 60 * 100) / 100; // 小数点2桁
            rows.push([
                entry.date,
                entry.domain,
                minutes.toString(),
                entry.isBlockingEnabled ? 'ON' : 'OFF'
            ]);
        });

        // CSVエスケープしてBOM付きで出力（Excelで文字化けしないため）
        return '\uFEFF' + rows.map(row =>
            row.map(cell => {
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        ).join('\n');
    },

    async exportPatienceToCSV(startDate, endDate) {
        const patienceData = await chrome.storage.local.get('stats_patience');
        let events = patienceData.stats_patience || [];

        // 日付フィルター
        if (startDate) {
            events = events.filter(e => e.date >= startDate);
        }
        if (endDate) {
            events = events.filter(e => e.date <= endDate);
        }

        if (events.length === 0) {
            return '日付,ドメイン,我慢回数\n';
        }

        // ピボットテーブル形式: 日付, ドメイン, 我慢回数
        const rows = [['日付', 'ドメイン', '我慢回数']];

        // 日付・ドメインでグループ化
        const grouped = {};
        events.forEach(event => {
            const key = `${event.date}|${event.domain}`;
            if (!grouped[key]) {
                grouped[key] = {
                    date: event.date,
                    domain: event.domain,
                    count: 0
                };
            }
            grouped[key].count++;
        });

        // 日付順にソート
        const sortedEntries = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));

        sortedEntries.forEach(entry => {
            rows.push([
                entry.date,
                entry.domain,
                entry.count.toString()
            ]);
        });

        // CSVエスケープしてBOM付きで出力
        return '\uFEFF' + rows.map(row =>
            row.map(cell => {
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        ).join('\n');
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatisticsStorage;
}
