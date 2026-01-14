// first-run-dialog.js

document.addEventListener('DOMContentLoaded', () => {
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
