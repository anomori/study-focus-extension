// first-run-dialog.js

document.addEventListener('DOMContentLoaded', async () => {
    // i18n初期化
    if (typeof I18n !== 'undefined') {
        await I18n.init();

        // 言語セレクタの初期化
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = I18n.getLanguage();
            languageSelect.addEventListener('change', async () => {
                await I18n.setLanguage(languageSelect.value);
                I18n.translatePage();
            });
        }
    }

    const recordPatience = document.getElementById('record-patience');
    const recordBrowsing = document.getElementById('record-browsing');
    const recordSnsOnly = document.getElementById('record-sns-only');
    const snsOnlyOption = document.getElementById('sns-only-option');
    const btnSkip = document.getElementById('btn-skip');
    const btnEnable = document.getElementById('btn-enable');

    // 閲覧記録OFFの時のみSNSのみオプションを有効化
    function updateSnsOnlyState() {
        if (recordBrowsing.checked) {
            snsOnlyOption.classList.remove('enabled');
            recordSnsOnly.checked = false;
        } else {
            snsOnlyOption.classList.add('enabled');
        }
    }

    recordBrowsing.addEventListener('change', updateSnsOnlyState);
    updateSnsOnlyState();

    // 記録しないボタン
    btnSkip.addEventListener('click', async () => {
        const settings = {
            enabled: false,
            recordPatienceCount: false,
            recordBrowsingTime: false,
            recordSnsTimeOnly: false,
            hasShownInitialPrompt: true
        };

        await StatisticsStorage.saveRecordingSettings(settings);
        window.close();
    });

    // 選択した項目を記録するボタン
    btnEnable.addEventListener('click', async () => {
        const hasAnyOption = recordPatience.checked || recordBrowsing.checked || recordSnsOnly.checked;

        const settings = {
            enabled: hasAnyOption,
            recordPatienceCount: recordPatience.checked,
            recordBrowsingTime: recordBrowsing.checked,
            recordSnsTimeOnly: !recordBrowsing.checked && recordSnsOnly.checked,
            hasShownInitialPrompt: true
        };

        await StatisticsStorage.saveRecordingSettings(settings);
        window.close();
    });
});
