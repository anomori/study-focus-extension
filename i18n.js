// i18n.js
// 国際化対応モジュール / Internationalization module

const I18n = (() => {
    // デフォルト言語 / Default language
    const DEFAULT_LANGUAGE = 'ja';

    // サポートする言語 / Supported languages
    const SUPPORTED_LANGUAGES = ['ja', 'en'];

    // 翻訳定義 / Translation definitions
    const MESSAGES = {
        ja: {
            // ========== 共通 / Common ==========
            'add': '追加',
            'remove': '削除',
            'save': '保存',
            'cancel': 'キャンセル',
            'close': '閉じる',
            'yes': 'はい',
            'no': 'いいえ',

            // ========== ポップアップ / Popup ==========
            'popup_title': '🎯 勉強の脱線防止',
            'score_loading': 'スコアを取得中...',
            'score_none': 'スコアなし',
            'score_no_tab': 'タブ情報なし',
            'score_waiting': '取得待ち',
            'score_error': 'エラー',
            'score_ok': 'OK',
            'score_warning': '注意',
            'score_block': 'ブロック',
            'blocking_toggle': '🛡️ 判定・ブロック機能',
            'check_toggle': '🔍 判定機能',
            'block_toggle': '🛡️ ブロック機能',
            'system_label': 'システム: ',
            'system_preparing': '準備中...',
            'system_starting': '起動中...',
            'system_ready': '準備完了 (AI Loaded)',
            'system_loading_model': 'モデル読込中...',
            'system_error': 'エラー (Reopen)',
            'study_topics_title': '📚 勉強する内容',
            'topic_placeholder': '例: 線形代数, 英語',
            'settings_button': '⚙️ 詳細設定・統計を見る',

            // ========== 設定ページ / Settings ==========
            'settings_title': '🎯 詳細設定',
            'tab_statistics': '📊 統計',
            'tab_sites': '🌐 サイト設定',
            'tab_advanced': '⚙️ 詳細設定',
            'tab_data': '🗑️ データ管理',

            // 統計タブ
            'stats_daily': '日別',
            'stats_monthly': '月別',
            'filter_label': '判定機能:',
            'filter_all': 'ON + OFF合計',
            'filter_on': 'ONの時のみ',
            'filter_off': 'OFFの時のみ',
            'patience_title': '💪 我慢回数',
            'patience_count': '{count}回',
            'detail_select_date': '日付を選択してください',
            'detail_total_label': '閲覧時間',
            'detail_patience_label': '我慢回数',
            'no_data': 'データがありません',
            'chart_usage_time': '使用時間（分）',

            // サイト設定タブ
            'allowlist_title': '✅ 許可サイト（警告なし）',
            'allowlist_desc': 'ここに追加したサイトはスコア測定・警告がスキップされます',
            'blocklist_title': '🚫 禁止サイト（完全ブロック）',
            'blocklist_desc': 'ここに追加したサイトは完全にブロックされます',
            'pattern_title': '🔗 禁止パターン（URLパス）',
            'pattern_desc': '特定のパスをブロック（例: YouTube Shorts）',
            'domain_placeholder': '例: example.com',
            'pattern_domain_placeholder': 'ドメイン',
            'pattern_path_placeholder': 'パス（例: /shorts）',

            // 詳細設定タブ
            'recording_title': '📊 記録設定',
            'setting_patience': '💪 我慢回数を記録',
            'setting_patience_desc': '警告を閉じずにページを離れた回数',
            'setting_browsing': '🌐 閲覧サイト・時間を記録',
            'setting_browsing_desc': 'どのサイトをどれくらい見たか',
            'setting_sns_only': '📱 SNSの時間だけ記録',
            'setting_sns_only_desc': 'Twitter, Instagram等のみ',
            'setting_debug': '🔧 デバッグ情報の表示',
            'setting_debug_desc': 'ポップアップに詳細な類似度スコアを表示',
            'timezone_title': '🌍 地域・タイムゾーン設定',
            'timezone_desc': 'グラフ表示に使用するタイムゾーンを指定',
            'timezone_auto': '自動検出',
            'timezone_region': '地域から選択',
            'timezone_manual': '手動入力 (UTCオフセット)',
            'timezone_region_placeholder': '地域名で検索 (例: Tokyo)',
            'timezone_manual_placeholder': '例: +09:00',
            'save_settings': '設定を保存',
            'settings_saved_reload': '設定を保存しました。反映のためページを再読み込みします。',

            // 言語設定
            'language_title': '🌐 言語設定 / Language',
            'language_desc': '表示言語を選択 / Select display language',
            'language_japanese': '日本語',
            'language_english': 'English',

            // データ管理タブ
            'export_title': '📤 データエクスポート',
            'export_desc': '統計データをファイルとして保存します',
            'export_all_periods': 'すべての期間',
            'export_specify_range': '期間を指定',
            'export_start_date': '開始日',
            'export_end_date': '終了日',
            'export_patience_data': '我慢回数データ',
            'export_browsing_data': '閲覧時間データ',
            'export_settings_data': '設定（サイト設定・記録設定・勉強項目）',
            'export_json': '📦 JSONでエクスポート',
            'export_csv_browsing': '📊 閲覧時間をCSV出力',
            'export_csv_patience': '💪 我慢回数をCSV出力',
            'export_hint': '💡 CSVはExcelでピボットテーブル/グラフ作成に最適な形式です',
            'import_title': '📥 データインポート',
            'import_desc': 'JSONファイルからデータを読み込みます',
            'import_merge': '既存データとマージ',
            'import_replace': '既存データを置き換え',
            'import_select_file': 'ファイルを選択',
            'import_button': 'インポート',
            'delete_title': '🗑️ データ削除',
            'delete_desc': '指定した期間のデータを削除します',
            'delete_range': '選択期間を削除',
            'delete_all': 'すべてのデータを削除',

            // アラートメッセージ
            'alert_select_file': 'ファイルを選択してください',
            'alert_invalid_file': '無効なファイル形式です。Study Focus Guardのエクスポートファイルを選択してください。',
            'alert_import_confirm_merge': 'データをマージモードでインポートしますか？',
            'alert_import_confirm_replace': 'データを置き換えモードでインポートしますか？',
            'alert_import_complete': 'インポート完了',
            'alert_patience_imported': '我慢回数: {count}件',
            'alert_browsing_imported': '閲覧記録: {count}件',
            'alert_topics_imported': '勉強項目: {count}件',
            'alert_settings_imported': '設定: インポート済み',
            'alert_import_error': 'ファイルの読み込みに失敗しました。',
            'alert_select_dates': '開始日と終了日を選択してください',
            'alert_invalid_date_range': '開始日は終了日より前の日付を選択してください',
            'alert_delete_confirm': '{start} から {end} までのデータを削除しますか？',
            'alert_delete_complete': '削除完了',
            'alert_deleted_patience': '我慢記録: {count}件',
            'alert_deleted_browsing': '閲覧記録: {count}件',
            'alert_delete_all_confirm1': '本当にすべてのデータを削除しますか？\nこの操作は取り消せません。',
            'alert_delete_all_confirm2': '最終確認です。すべての統計データが削除されます。',
            'alert_delete_all_complete': 'すべてのデータを削除しました',

            // ========== コンテンツスクリプト / Content Script ==========
            'overlay_title': '⚠️ 勉強に関係ありますか？',
            'overlay_message': '登録された勉強内容と関連が薄い可能性があります。',
            'overlay_dismiss': '関係ある（閉じる）',
            'overlay_score': '類似度スコア: {score} (判定: 低)',
            'block_title': 'ブロック中',
            'block_message': '{site}は勉強中にブロックされています。',

            // ========== 初回設定ダイアログ / First Run Dialog ==========
            'firstrun_title': 'データの記録を有効にしますか？',
            'firstrun_subtitle': '統計機能を使って、勉強の進捗を確認できます',
            'firstrun_patience_title': '我慢回数を記録する',
            'firstrun_patience_desc': '警告を閉じずにページを離れた回数を記録',
            'firstrun_browsing_title': '閲覧サイト・時間を記録する',
            'firstrun_browsing_desc': 'どのサイトをどれくらい見たかを記録',
            'firstrun_sns_title': 'SNSの時間だけ記録する',
            'firstrun_sns_desc': 'Twitter, Instagram, TikTokなどのみ',
            'firstrun_privacy': 'データはすべてローカルに保存され、外部には送信されません。いつでも設定を変更・削除できます。',
            'firstrun_skip': '記録しない',
            'firstrun_enable': '選択した項目を記録する',

            // タイマー設定
            'timer_title': '⏰ 自動切替タイマー',
            'timer_check_label': '判定機能タイマー',
            'timer_block_label': 'ブロック機能タイマー',
            'timer_action_on': 'ONにする',
            'timer_action_off': 'OFFにする',
            'timer_action_none': '-',
            'timer_after': '後に',
            'timer_set': 'セット',
            'timer_cancel': '解除',
            'timer_remaining': '残り {time}',
            'timer_not_set': '未設定',
            'timer_set_success': 'タイマーをセットしました',
            'timer_cancelled': 'タイマーを解除しました',
            'timer_fired': 'タイマーにより{feature}を{action}しました',
            'timer_feature_check': '判定機能',
            'timer_feature_block': 'ブロック機能',
            'timer_feature_both': '両方',
            'timer_action_on_past': 'ON',
            'timer_action_off_past': 'OFF',
            'timer_minutes': '分後',
            'timer_custom': 'カスタム',
            'timer_preset_5': '5分',
            'timer_preset_10': '10分',
            'timer_preset_15': '15分',
            'timer_preset_30': '30分',
            'timer_preset_60': '1時間',
            'timer_preset_90': '1.5時間',
            'timer_preset_120': '2時間',
            'timer_preset_180': '3時間',
            'timer_preset_360': '6時間',
            'timer_mode_relative': 'プリセット',
            'timer_mode_duration': '○時間○分後',
            'timer_mode_absolute': '時刻指定',
            'timer_target': '対象',
            'timer_target_check': '判定',
            'timer_target_block': 'ブロック',
            'timer_target_both': '両方',
            'timer_hours': '時間',
            'timer_mins': '分',
            'timer_at': 'に',
            'timer_repeat_daily': '毎日繰り返す',
            'timer_repeat_label': '🔁 繰り返し',
            'timer_scheduled_at': '{time} に {action}',
            'timer_daily_repeat': '（毎日）',

            // 月名
            'month_1': '1月', 'month_2': '2月', 'month_3': '3月', 'month_4': '4月',
            'month_5': '5月', 'month_6': '6月', 'month_7': '7月', 'month_8': '8月',
            'month_9': '9月', 'month_10': '10月', 'month_11': '11月', 'month_12': '12月',
            'year_month_format': '{year}年{month}',
            'year_format': '{year}年',
            'total_suffix': '（合計）',
            'day_names': ['日', '月', '火', '水', '木', '金', '土'],
            'date_format': '{month}{day}日（{weekday}）'
        },
        en: {
            // ========== Common ==========
            'add': 'Add',
            'remove': 'Remove',
            'save': 'Save',
            'cancel': 'Cancel',
            'close': 'Close',
            'yes': 'Yes',
            'no': 'No',

            // ========== Popup ==========
            'popup_title': '🎯 Study Focus Guard',
            'score_loading': 'Loading score...',
            'score_none': 'No score',
            'score_no_tab': 'No tab info',
            'score_waiting': 'Waiting...',
            'score_error': 'Error',
            'score_ok': 'OK',
            'score_warning': 'Warning',
            'score_block': 'Block',
            'blocking_toggle': '🛡️ Block/Check Feature',
            'check_toggle': '🔍 Check Feature',
            'block_toggle': '🛡️ Block Feature',
            'system_label': 'System: ',
            'system_preparing': 'Preparing...',
            'system_starting': 'Starting...',
            'system_ready': 'Ready (AI Loaded)',
            'system_loading_model': 'Loading model...',
            'system_error': 'Error (Reopen)',
            'study_topics_title': '📚 Study Topics',
            'topic_placeholder': 'e.g. Linear Algebra, English',
            'settings_button': '⚙️ Settings & Statistics',

            // ========== Settings ==========
            'settings_title': '🎯 Advanced Settings',
            'tab_statistics': '📊 Statistics',
            'tab_sites': '🌐 Site Settings',
            'tab_advanced': '⚙️ Advanced',
            'tab_data': '🗑️ Data Management',

            // Statistics tab
            'stats_daily': 'Daily',
            'stats_monthly': 'Monthly',
            'filter_label': 'Check feature:',
            'filter_all': 'ON + OFF Total',
            'filter_on': 'When ON only',
            'filter_off': 'When OFF only',
            'patience_title': '💪 Patience Count',
            'patience_count': '{count} times',
            'detail_select_date': 'Select a date',
            'detail_total_label': 'Browsing Time',
            'detail_patience_label': 'Patience Count',
            'no_data': 'No data',
            'chart_usage_time': 'Usage Time (min)',

            // Site Settings tab
            'allowlist_title': '✅ Allowed Sites (No Warning)',
            'allowlist_desc': 'Sites added here will skip score check and warnings',
            'blocklist_title': '🚫 Blocked Sites (Complete Block)',
            'blocklist_desc': 'Sites added here will be completely blocked',
            'pattern_title': '🔗 Block Patterns (URL Path)',
            'pattern_desc': 'Block specific paths (e.g. YouTube Shorts)',
            'domain_placeholder': 'e.g. example.com',
            'pattern_domain_placeholder': 'Domain',
            'pattern_path_placeholder': 'Path (e.g. /shorts)',

            // Advanced tab
            'recording_title': '📊 Recording Settings',
            'setting_patience': '💪 Record Patience Count',
            'setting_patience_desc': 'Count of leaving pages without closing warning',
            'setting_browsing': '🌐 Record Browsing Sites & Time',
            'setting_browsing_desc': 'Which sites you visit and for how long',
            'setting_sns_only': '📱 Record SNS Time Only',
            'setting_sns_only_desc': 'Twitter, Instagram, etc. only',
            'setting_debug': '🔧 Show Debug Info',
            'setting_debug_desc': 'Show detailed similarity scores in popup',
            'timezone_title': '🌍 Region & Timezone',
            'timezone_desc': 'Specify timezone for chart display',
            'timezone_auto': 'Auto-detect',
            'timezone_region': 'Select by region',
            'timezone_manual': 'Manual input (UTC offset)',
            'timezone_region_placeholder': 'Search by region (e.g. Tokyo)',
            'timezone_manual_placeholder': 'e.g. +09:00',
            'save_settings': 'Save Settings',
            'settings_saved_reload': 'Settings saved. Reloading page to apply changes.',

            // Language settings
            'language_title': '🌐 言語設定 / Language',
            'language_desc': '表示言語を選択 / Select display language',
            'language_japanese': '日本語',
            'language_english': 'English',

            // Data Management tab
            'export_title': '📤 Export Data',
            'export_desc': 'Save statistics data to a file',
            'export_all_periods': 'All periods',
            'export_specify_range': 'Specify range',
            'export_start_date': 'Start Date',
            'export_end_date': 'End Date',
            'export_patience_data': 'Patience count data',
            'export_browsing_data': 'Browsing time data',
            'export_settings_data': 'Settings (sites, recording, study topics)',
            'export_json': '📦 Export as JSON',
            'export_csv_browsing': '📊 Export Browsing Time CSV',
            'export_csv_patience': '💪 Export Patience Count CSV',
            'export_hint': '💡 CSV is ideal for creating pivot tables/charts in Excel',
            'import_title': '📥 Import Data',
            'import_desc': 'Load data from a JSON file',
            'import_merge': 'Merge with existing data',
            'import_replace': 'Replace existing data',
            'import_select_file': 'Select file',
            'import_button': 'Import',
            'delete_title': '🗑️ Delete Data',
            'delete_desc': 'Delete data within specified period',
            'delete_range': 'Delete selected range',
            'delete_all': 'Delete all data',

            // Alert messages
            'alert_select_file': 'Please select a file',
            'alert_invalid_file': 'Invalid file format. Please select a Study Focus Guard export file.',
            'alert_import_confirm_merge': 'Import data in merge mode?',
            'alert_import_confirm_replace': 'Import data in replace mode?',
            'alert_import_complete': 'Import complete',
            'alert_patience_imported': 'Patience count: {count} records',
            'alert_browsing_imported': 'Browsing records: {count} records',
            'alert_topics_imported': 'Study topics: {count} items',
            'alert_settings_imported': 'Settings: imported',
            'alert_import_error': 'Failed to read file.',
            'alert_select_dates': 'Please select start and end dates',
            'alert_invalid_date_range': 'Start date must be before end date',
            'alert_delete_confirm': 'Delete data from {start} to {end}?',
            'alert_delete_complete': 'Deletion complete',
            'alert_deleted_patience': 'Patience records: {count} items',
            'alert_deleted_browsing': 'Browsing records: {count} items',
            'alert_delete_all_confirm1': 'Are you sure you want to delete all data?\nThis action cannot be undone.',
            'alert_delete_all_confirm2': 'Final confirmation. All statistics data will be deleted.',
            'alert_delete_all_complete': 'All data has been deleted',

            // ========== Content Script ==========
            'overlay_title': '⚠️ Is this related to your study?',
            'overlay_message': 'This content may not be related to your registered study topics.',
            'overlay_dismiss': 'Yes, it\'s related (Close)',
            'overlay_score': 'Similarity score: {score} (Result: Low)',
            'block_title': 'Blocked',
            'block_message': '{site} is blocked during study time.',

            // ========== First Run Dialog ==========
            'firstrun_title': 'Enable data recording?',
            'firstrun_subtitle': 'Use statistics to track your study progress',
            'firstrun_patience_title': 'Record patience count',
            'firstrun_patience_desc': 'Track times you left pages without closing warnings',
            'firstrun_browsing_title': 'Record browsing sites & time',
            'firstrun_browsing_desc': 'Track which sites you visit and for how long',
            'firstrun_sns_title': 'Record SNS time only',
            'firstrun_sns_desc': 'Twitter, Instagram, TikTok, etc. only',
            'firstrun_privacy': 'All data is stored locally and never sent externally. You can change or delete settings anytime.',
            'firstrun_skip': 'Don\'t record',
            'firstrun_enable': 'Record selected items',

            // Timer settings
            'timer_title': '⏰ Auto-Switch Timer',
            'timer_check_label': 'Check Feature Timer',
            'timer_block_label': 'Block Feature Timer',
            'timer_action_on': 'Turn ON',
            'timer_action_off': 'Turn OFF',
            'timer_action_none': '-',
            'timer_after': 'later,',
            'timer_set': 'Set',
            'timer_cancel': 'Cancel',
            'timer_remaining': '{time} remaining',
            'timer_not_set': 'Not set',
            'timer_set_success': 'Timer has been set',
            'timer_cancelled': 'Timer has been cancelled',
            'timer_fired': '{feature} has been turned {action} by timer',
            'timer_feature_check': 'Check feature',
            'timer_feature_block': 'Block feature',
            'timer_feature_both': 'Both',
            'timer_action_on_past': 'ON',
            'timer_action_off_past': 'OFF',
            'timer_minutes': ' min',
            'timer_custom': 'Custom',
            'timer_preset_5': '5m',
            'timer_preset_10': '10m',
            'timer_preset_15': '15m',
            'timer_preset_30': '30m',
            'timer_preset_60': '1h',
            'timer_preset_90': '1.5h',
            'timer_preset_120': '2h',
            'timer_preset_180': '3h',
            'timer_preset_360': '6h',
            'timer_mode_relative': 'Preset',
            'timer_mode_duration': 'In Xh Xm',
            'timer_mode_absolute': 'At time',
            'timer_target': 'Target',
            'timer_target_check': 'Check',
            'timer_target_block': 'Block',
            'timer_target_both': 'Both',
            'timer_hours': 'h',
            'timer_mins': 'm',
            'timer_at': 'at',
            'timer_repeat_daily': 'Repeat daily',
            'timer_repeat_label': '🔁 Repeat',
            'timer_scheduled_at': '{action} at {time}',
            'timer_daily_repeat': '(daily)',

            // Month names
            'month_1': 'Jan', 'month_2': 'Feb', 'month_3': 'Mar', 'month_4': 'Apr',
            'month_5': 'May', 'month_6': 'Jun', 'month_7': 'Jul', 'month_8': 'Aug',
            'month_9': 'Sep', 'month_10': 'Oct', 'month_11': 'Nov', 'month_12': 'Dec',
            'year_month_format': '{month} {year}',
            'year_format': '{year}',
            'total_suffix': ' (Total)',
            'day_names': ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            'date_format': '{month} {day} ({weekday})'
        }
    };

    let currentLanguage = DEFAULT_LANGUAGE;

    /**
     * 現在の言語を取得 / Get current language
     */
    function getLanguage() {
        return currentLanguage;
    }

    /**
     * 言語を設定 / Set language
     * @param {string} lang - 'ja' or 'en'
     */
    async function setLanguage(lang) {
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            console.warn(`Unsupported language: ${lang}. Using default: ${DEFAULT_LANGUAGE}`);
            lang = DEFAULT_LANGUAGE;
        }
        currentLanguage = lang;
        await chrome.storage.local.set({ language: lang });
    }

    /**
     * ストレージから言語を読み込み / Load language from storage
     */
    async function loadLanguage() {
        try {
            const data = await chrome.storage.local.get('language');
            if (data.language && SUPPORTED_LANGUAGES.includes(data.language)) {
                currentLanguage = data.language;
            }
        } catch (e) {
            console.error('Failed to load language setting:', e);
        }
        return currentLanguage;
    }

    /**
     * 翻訳を取得 / Get translated message
     * @param {string} key - メッセージキー
     * @param {Object} params - 置換パラメータ (オプション)
     * @returns {string} 翻訳されたメッセージ
     */
    function getMessage(key, params = {}) {
        const messages = MESSAGES[currentLanguage] || MESSAGES[DEFAULT_LANGUAGE];
        let message = messages[key];

        if (message === undefined) {
            console.warn(`Missing translation for key: ${key}`);
            // フォールバック: キーをそのまま返す
            return key;
        }

        // パラメータ置換
        if (typeof message === 'string') {
            Object.keys(params).forEach(param => {
                message = message.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
            });
        }

        return message;
    }

    /**
     * ページ内の data-i18n 属性を持つ要素を翻訳 / Translate elements with data-i18n attribute
     */
    function translatePage() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = getMessage(key);
            if (translation && typeof translation === 'string') {
                el.textContent = translation;
            }
        });

        // placeholder属性の翻訳
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = getMessage(key);
            if (translation && typeof translation === 'string') {
                el.placeholder = translation;
            }
        });

        // title属性の翻訳
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = getMessage(key);
            if (translation && typeof translation === 'string') {
                el.title = translation;
            }
        });
    }

    /**
     * 初期化 / Initialize
     */
    async function init() {
        await loadLanguage();
        translatePage();
    }

    // 公開API / Public API
    return {
        init,
        getLanguage,
        setLanguage,
        loadLanguage,
        getMessage,
        translatePage,
        SUPPORTED_LANGUAGES
    };
})();

// グローバルに公開 / Expose globally
if (typeof window !== 'undefined') {
    window.I18n = I18n;
}
