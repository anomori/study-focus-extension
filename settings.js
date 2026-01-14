// settings.js
// 詳細設定ページのロジック

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initStatistics();
    initSiteSettings();
    initRecordingSettings();
    initDataManagement();
});

// ========== タブ管理 ==========
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            // 統計タブを開いた時にグラフを更新
            if (tabId === 'statistics') {
                updateChart();
            }
        });
    });
}

// ========== 統計機能 ==========
let currentDate = new Date();
let currentView = 'day';
let usageChart = null;
let selectedBarIndex = null;

function initStatistics() {
    // ビュー切り替え
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            updateChart();
        });
    });

    // 期間ナビゲーション
    document.getElementById('prev-period').addEventListener('click', () => {
        if (currentView === 'day') {
            currentDate.setMonth(currentDate.getMonth() - 1);
        } else {
            currentDate.setFullYear(currentDate.getFullYear() - 1);
        }
        updateChart();
    });

    document.getElementById('next-period').addEventListener('click', () => {
        if (currentView === 'day') {
            currentDate.setMonth(currentDate.getMonth() + 1);
        } else {
            currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
        updateChart();
    });

    // フィルター変更
    document.getElementById('blocking-filter').addEventListener('change', updateChart);

    // 初期表示
    updateChart();
}

async function updateChart() {
    const filter = document.getElementById('blocking-filter').value;
    const filterBlocking = filter === 'all' ? null : filter === 'on';

    // タイムゾーン設定を取得
    const timezone = await getTimezoneSetting();

    // 期間表示を更新
    const periodText = currentView === 'day'
        ? `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`
        : `${currentDate.getFullYear()}年`;
    document.getElementById('current-period').textContent = periodText;

    // データ取得
    let startDate, endDate;
    if (currentView === 'day') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
        startDate = `${currentDate.getFullYear()}-01-01`;
        endDate = `${currentDate.getFullYear()}-12-31`;
    }

    const stats = await StatisticsStorage.getStatistics(startDate, endDate, {
        groupBy: currentView,
        filterBlocking,
        timezone
    });

    // 我慢回数を表示
    document.getElementById('patience-count').textContent = `${stats.totals.patienceCount}回`;

    // グラフデータを準備
    const labels = [];
    const keys = [];
    const data = [];
    const browsingData = stats.browsing;

    if (currentView === 'day') {
        // 日別: その月の各日
        const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            labels.push(d);
            keys.push(dateStr);
            data.push(browsingData[dateStr] ? browsingData[dateStr].totalTime / 1000 / 60 : 0); // 分単位
        }
    } else {
        // 月別: 12ヶ月
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        for (let m = 0; m < 12; m++) {
            const monthStr = `${currentDate.getFullYear()}-${String(m + 1).padStart(2, '0')}`;
            labels.push(monthNames[m]);
            keys.push(monthStr);
            data.push(browsingData[monthStr] ? browsingData[monthStr].totalTime / 1000 / 60 : 0);
        }
    }

    // 初期表示は全体集計
    selectedBarIndex = null;
    showDetailForIndex(null, stats);
    renderChart(labels, data, stats, keys);
}

function renderChart(labels, data, stats, keys) {
    const ctx = document.getElementById('usage-chart').getContext('2d');

    if (usageChart) {
        usageChart.destroy();
    }

    const backgroundColors = data.map((_, i) =>
        i === selectedBarIndex ? 'rgba(0, 217, 255, 1)' : 'rgba(0, 217, 255, 0.6)'
    );

    usageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '使用時間（分）',
                data: data,
                backgroundColor: backgroundColors,
                borderColor: 'rgba(0, 217, 255, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    selectedBarIndex = index;

                    // ハイライト更新（アニメーションなし）
                    const newColors = data.map((_, i) =>
                        i === index ? 'rgba(0, 217, 255, 1)' : 'rgba(0, 217, 255, 0.4)'
                    );
                    usageChart.data.datasets[0].backgroundColor = newColors;
                    usageChart.update('none');

                    // キーを使って詳細表示
                    showDetailForIndex(keys[index], stats);
                } else {
                    // 背景クリックで選択解除
                    if (selectedBarIndex !== null) {
                        selectedBarIndex = null;
                        const defaultColors = data.map(() => 'rgba(0, 217, 255, 0.6)');
                        usageChart.data.datasets[0].backgroundColor = defaultColors;
                        usageChart.update('none');

                        showDetailForIndex(null, stats);
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const minutes = context.raw;
                            if (minutes >= 60) {
                                return `${Math.floor(minutes / 60)}時間${Math.round(minutes % 60)}分`;
                            }
                            return `${Math.round(minutes)}分`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#888'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#888',
                        callback: (value) => {
                            if (value >= 60) {
                                return `${Math.floor(value / 60)}h`;
                            }
                            return `${value}m`;
                        }
                    }
                }
            }
        }
    });
}

// key: 'YYYY-MM-DD' or 'YYYY-MM' or null
function showDetailForIndex(key, stats) {
    const detailTitle = document.getElementById('detail-title');
    const detailTotal = document.getElementById('detail-total');
    const detailPatience = document.getElementById('detail-patience');
    const detailList = document.getElementById('detail-list');

    if (!key) {
        // 全体集計
        detailTitle.textContent = document.getElementById('current-period').textContent + '（合計）';
        detailTotal.textContent = StatisticsStorage.formatDuration(stats.totals.totalBrowsingTime);
        detailPatience.textContent = `${stats.totals.patienceCount}回`;

        renderDomainList(stats.totals.browsingByDomain, detailList);
        return;
    }

    // 個別データの取得
    const browsingItem = stats.browsing[key] || { totalTime: 0, domains: {} };
    const patienceItem = stats.patience[key] || { count: 0 };

    // タイトルの設定
    if (currentView === 'day') {
        const [y, m, d] = key.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        detailTitle.textContent = `${m}月${d}日（${dayNames[dateObj.getDay()]}）`;
    } else {
        const [y, m] = key.split('-').map(Number);
        detailTitle.textContent = `${m}月`;
    }

    // 値の設定
    detailTotal.textContent = StatisticsStorage.formatDuration(browsingItem.totalTime);
    detailPatience.textContent = `${patienceItem.count}回`;

    // ドメイン別リストの生成
    const domainData = Object.entries(browsingItem.domains)
        .sort((a, b) => b[1] - a[1]) // 時間順ソート
        .map(([domain, time]) => ({ domain, time }));

    renderDomainList(domainData, detailList);
}

function renderDomainList(domainData, container) {
    if (domainData.length === 0) {
        container.innerHTML = '<div class="no-data"><div class="no-data-icon">📭</div><p>データがありません</p></div>';
        return;
    }

    const top10 = domainData.slice(0, 10);
    container.innerHTML = top10.map((item, i) => `
        <div class="detail-item">
            <span class="rank">${i + 1}.</span>
            <span class="domain">${item.domain}</span>
            <span class="time">${StatisticsStorage.formatDuration(item.time)}</span>
        </div>
    `).join('');
}

// ========== サイト設定 ==========
async function initSiteSettings() {
    await loadSiteSettings();

    document.getElementById('add-allowlist').addEventListener('click', async () => {
        const input = document.getElementById('allowlist-input');
        const domain = input.value.trim();
        if (domain) {
            await StatisticsStorage.addToAllowlist(domain);
            input.value = '';
            await loadSiteSettings();
        }
    });

    document.getElementById('add-blocklist').addEventListener('click', async () => {
        const input = document.getElementById('blocklist-input');
        const domain = input.value.trim();
        if (domain) {
            await StatisticsStorage.addToBlocklist(domain);
            input.value = '';
            await loadSiteSettings();
        }
    });

    document.getElementById('add-pattern').addEventListener('click', async () => {
        const domainInput = document.getElementById('pattern-domain');
        const pathInput = document.getElementById('pattern-path');
        const domain = domainInput.value.trim();
        const path = pathInput.value.trim();
        if (domain && path) {
            await StatisticsStorage.addBlockedPattern(domain, path);
            domainInput.value = '';
            pathInput.value = '';
            await loadSiteSettings();
        }
    });
}

async function loadSiteSettings() {
    const settings = await StatisticsStorage.getSiteSettings();

    // 許可リスト
    const allowlistEl = document.getElementById('allowlist');
    allowlistEl.innerHTML = settings.allowlist.map(domain => `
        <li>
            <span class="domain-text">${domain}</span>
            <button class="remove-btn" data-domain="${domain}" data-list="allowlist">削除</button>
        </li>
    `).join('');

    // 禁止リスト
    const blocklistEl = document.getElementById('blocklist');
    blocklistEl.innerHTML = settings.blocklist.map(domain => `
        <li>
            <span class="domain-text">${domain}</span>
            <button class="remove-btn" data-domain="${domain}" data-list="blocklist">削除</button>
        </li>
    `).join('');

    // パターンリスト
    const patternsEl = document.getElementById('blocked-patterns');
    patternsEl.innerHTML = settings.blockedPatterns.map(p => `
        <li>
            <span class="domain-text">${p.domain}${p.pathPattern}</span>
            <button class="remove-btn" data-domain="${p.domain}" data-path="${p.pathPattern}" data-list="pattern">削除</button>
        </li>
    `).join('');

    // 削除ボタンのイベント
    document.querySelectorAll('.site-list .remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const list = btn.dataset.list;
            const domain = btn.dataset.domain;

            if (list === 'allowlist') {
                await StatisticsStorage.removeFromAllowlist(domain);
            } else if (list === 'blocklist') {
                await StatisticsStorage.removeFromBlocklist(domain);
            } else if (list === 'pattern') {
                await StatisticsStorage.removeBlockedPattern(domain, btn.dataset.path);
            }

            await loadSiteSettings();
        });
    });
}

// ========== 記録設定 ==========
async function initRecordingSettings() {
    const settings = await StatisticsStorage.getRecordingSettings();

    const patienceEl = document.getElementById('setting-patience');
    const browsingEl = document.getElementById('setting-browsing');
    const snsOnlyEl = document.getElementById('setting-sns-only');
    const snsSettingEl = document.getElementById('sns-setting');

    // 既存設定の反映
    patienceEl.checked = settings.recordPatienceCount;
    browsingEl.checked = settings.recordBrowsingTime;
    snsOnlyEl.checked = settings.recordSnsTimeOnly;

    // タイムゾーン設定の反映
    const tzRadios = document.getElementsByName('timezone-mode');

    // 自動検出結果の表示
    try {
        const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const displayEl = document.getElementById('auto-timezone-display');
        if (displayEl) {
            displayEl.textContent = `(${detectedTz})`;
        }
    } catch (e) {
        console.error('Failed to detect timezone', e);
    }

    tzRadios.forEach(radio => {
        if (radio.value === settings.timezoneMode) radio.checked = true;
    });

    document.getElementById('timezone-region').value = settings.timezoneRegion || '';
    document.getElementById('timezone-manual').value = settings.timezoneManual || '';

    // タイムゾーンリストの生成
    populateTimezoneList();

    // タイムゾーン入力エリアの表示制御
    function updateTzInputVisibility() {
        const mode = document.querySelector('input[name="timezone-mode"]:checked').value;
        document.getElementById('timezone-region-input').style.display = mode === 'region' ? 'block' : 'none';
        document.getElementById('timezone-manual-input').style.display = mode === 'manual' ? 'block' : 'none';
    }

    tzRadios.forEach(radio => radio.addEventListener('change', updateTzInputVisibility));
    updateTzInputVisibility(); // 初期状態設定

    function updateSnsState() {
        if (browsingEl.checked) {
            snsSettingEl.classList.remove('enabled');
            snsOnlyEl.checked = false;
        } else {
            snsSettingEl.classList.add('enabled');
        }
    }

    browsingEl.addEventListener('change', updateSnsState);
    updateSnsState();

    document.getElementById('save-recording-settings').addEventListener('click', async () => {
        const hasAnyOption = patienceEl.checked || browsingEl.checked || snsOnlyEl.checked;
        const timezoneMode = document.querySelector('input[name="timezone-mode"]:checked').value;

        const newSettings = {
            enabled: hasAnyOption,
            recordPatienceCount: patienceEl.checked,
            recordBrowsingTime: browsingEl.checked,
            recordSnsTimeOnly: !browsingEl.checked && snsOnlyEl.checked,
            hasShownInitialPrompt: true,
            timezoneMode,
            timezoneRegion: document.getElementById('timezone-region').value.trim(),
            timezoneManual: document.getElementById('timezone-manual').value.trim()
        };

        await StatisticsStorage.saveRecordingSettings(newSettings);

        // グラフ更新のためにリロード
        alert('設定を保存しました。反映のためページを再読み込みします。');
        location.reload();
    });
}

function populateTimezoneList() {
    const dataList = document.getElementById('timezone-list');
    if (!dataList || dataList.options.length > 0) return;

    try {
        if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
            const timezones = Intl.supportedValuesOf('timeZone');
            timezones.forEach(tz => {
                const option = document.createElement('option');
                option.value = tz;
                dataList.appendChild(option);
            });
        }
    } catch (e) {
        console.error('Timezone list not supported', e);
    }
}

async function getTimezoneSetting() {
    const settings = await StatisticsStorage.getRecordingSettings();
    if (settings.timezoneMode === 'manual' && settings.timezoneManual) {
        return settings.timezoneManual;
    } else if (settings.timezoneMode === 'region' && settings.timezoneRegion) {
        return settings.timezoneRegion;
    } else {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
}

// ========== データ管理 ==========
function initDataManagement() {
    // 今日の日付をデフォルトに
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('delete-end-date').value = today;
    document.getElementById('export-end-date').value = today;

    // エクスポート期間選択の切り替え
    document.querySelectorAll('input[name="export-range"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const rangeDiv = document.getElementById('export-date-range');
            if (radio.value === 'range' && radio.checked) {
                rangeDiv.style.display = 'flex';
            } else if (radio.value === 'all' && radio.checked) {
                rangeDiv.style.display = 'none';
            }
        });
    });

    // JSONエクスポート
    document.getElementById('export-json').addEventListener('click', async () => {
        const { startDate, endDate } = getExportDateRange();

        const options = {
            startDate,
            endDate,
            includePatience: document.getElementById('export-patience').checked,
            includeBrowsing: document.getElementById('export-browsing').checked,
            includeSettings: document.getElementById('export-settings').checked
        };

        const data = await StatisticsStorage.exportAllData(options);
        downloadFile(
            JSON.stringify(data, null, 2),
            `study-focus-backup-${new Date().toISOString().split('T')[0]}.json`,
            'application/json'
        );
    });

    // CSV（閲覧時間）エクスポート
    document.getElementById('export-csv-browsing').addEventListener('click', async () => {
        const { startDate, endDate } = getExportDateRange();
        const csv = await StatisticsStorage.exportBrowsingToCSV(startDate, endDate);
        downloadFile(
            csv,
            `browsing-time-${new Date().toISOString().split('T')[0]}.csv`,
            'text/csv;charset=utf-8'
        );
    });

    // CSV（我慢回数）エクスポート
    document.getElementById('export-csv-patience').addEventListener('click', async () => {
        const { startDate, endDate } = getExportDateRange();
        const csv = await StatisticsStorage.exportPatienceToCSV(startDate, endDate);
        downloadFile(
            csv,
            `patience-count-${new Date().toISOString().split('T')[0]}.csv`,
            'text/csv;charset=utf-8'
        );
    });

    // インポート - ファイル選択
    document.getElementById('import-select').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('import-filename').textContent = file.name;
            document.getElementById('import-data').disabled = false;
        } else {
            document.getElementById('import-filename').textContent = '';
            document.getElementById('import-data').disabled = true;
        }
    });

    // インポート実行
    document.getElementById('import-data').addEventListener('click', async () => {
        const fileInput = document.getElementById('import-file');
        const file = fileInput.files[0];
        if (!file) {
            alert('ファイルを選択してください');
            return;
        }

        const mode = document.querySelector('input[name="import-mode"]:checked').value;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // バリデーション
            if (!data.version) {
                alert('無効なファイル形式です。Study Focus Guardのエクスポートファイルを選択してください。');
                return;
            }

            const modeText = mode === 'merge' ? 'マージ' : '置き換え';
            if (!confirm(`データを${modeText}モードでインポートしますか？`)) {
                return;
            }

            const results = await StatisticsStorage.importData(data, mode);

            let message = 'インポート完了\n';
            if (results.patienceImported > 0) {
                message += `- 我慢回数: ${results.patienceImported}件\n`;
            }
            if (results.browsingImported > 0) {
                message += `- 閲覧記録: ${results.browsingImported}件\n`;
            }
            if (results.studyTopicsImported > 0) {
                message += `- 勉強項目: ${results.studyTopicsImported}件\n`;
            }
            if (results.settingsImported) {
                message += `- 設定: インポート済み\n`;
            }

            alert(message);
            updateChart();

            // ファイル選択をリセット
            fileInput.value = '';
            document.getElementById('import-filename').textContent = '';
            document.getElementById('import-data').disabled = true;

        } catch (e) {
            console.error('Import error:', e);
            alert('ファイルの読み込みに失敗しました。\n' + e.message);
        }
    });

    // 期間指定削除
    document.getElementById('delete-range').addEventListener('click', async () => {
        const startDate = document.getElementById('delete-start-date').value;
        const endDate = document.getElementById('delete-end-date').value;

        if (!startDate || !endDate) {
            alert('開始日と終了日を選択してください');
            return;
        }

        if (startDate > endDate) {
            alert('開始日は終了日より前の日付を選択してください');
            return;
        }

        if (confirm(`${startDate} から ${endDate} までのデータを削除しますか？`)) {
            const result = await StatisticsStorage.deleteDataInRange(startDate, endDate);
            alert(`削除完了\n- 我慢記録: ${result.deletedPatienceCount}件\n- 閲覧記録: ${result.deletedBrowsingCount}件`);
            updateChart();
        }
    });

    // 全削除
    document.getElementById('delete-all').addEventListener('click', async () => {
        if (confirm('本当にすべてのデータを削除しますか？\nこの操作は取り消せません。')) {
            if (confirm('最終確認です。すべての統計データが削除されます。')) {
                await StatisticsStorage.deleteAllData();
                alert('すべてのデータを削除しました');
                updateChart();
            }
        }
    });
}

// エクスポート日付範囲を取得
function getExportDateRange() {
    const rangeType = document.querySelector('input[name="export-range"]:checked').value;

    if (rangeType === 'all') {
        return { startDate: null, endDate: null };
    }

    return {
        startDate: document.getElementById('export-start-date').value || null,
        endDate: document.getElementById('export-end-date').value || null
    };
}

// ファイルダウンロード
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
