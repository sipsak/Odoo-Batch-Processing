// ==UserScript==
// @name            Odoo Batch Processing
// @name:tr         Odoo Toplu Güncelleme
// @namespace       https://github.com/sipsak
// @version         1.5
// @description     It adds a batch update feature for rows in Odoo. To perform a batch update, you need to Ctrl + click on the column header you want to update.
// @description:tr  Odoo'da satırlarda toplu güncelleme yapma özelliği ekler, toplu güncelleme yapmak istediğiniz sütun başlığına Ctrl ile birlikte tıklamanız gerekir.
// @author          Burak Şipşak
// @match           https://portal.bskhvac.com.tr/*
// @match           https://*.odoo.com/*
// @grant           none
// @icon            https://raw.githubusercontent.com/sipsak/odoo-image-enlarger/refs/heads/main/icon.png
// @updateURL       https://raw.githubusercontent.com/sipsak/Odoo-Batch-Processing/main/Odoo-Batch-Processing.user.js
// @downloadURL     https://raw.githubusercontent.com/sipsak/Odoo-Batch-Processing/main/Odoo-Batch-Processing.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Kullanıcı arayüzü için stil tanımı
    const styles = `
        .bulk-update-dialog {
            position: fixed;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.3);
            z-index: 9999;
            min-width: 350px;
        }
        .bulk-update-dialog h3 {
            margin-top: 0;
            color: #714b67;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }
        .bulk-update-buttons {
            text-align: right;
            margin-top: 15px;
        }
        .bulk-notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: opacity 0.5s;
        }
        .bulk-notification-success {
            background-color: #28a745;
        }
        .bulk-notification-warning {
            background-color: #ffc107;
            color: #333;
        }
        .bulk-notification-error {
            background-color: #dc3545;
        }
        .bulk-multiline-area {
            width: 100%;
            min-height: 150px;
            margin-top: 10px;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: monospace;
        }
        .update-info-text {
            margin-top: 10px;
            font-size: 14px;
            color: #714b67;
            margin-bottom: 10px;
        }
        .update-scope-selector {
            margin-top: 5px;
            margin-bottom: 15px;
        }
        .update-scope-selector label {
            margin-right: 15px;
            font-weight: normal;
        }
        .update-scope-selector input[type="radio"] {
            margin-right: 5px;
        }
    `;

    // Stilleri ekle
    function addStyles() {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = styles;
        document.head.appendChild(styleElement);
    }

    // Ana fonksiyon - script başlangıcı
    function initialize() {
        addStyles();

        // Sayfa yüklendiğinde dokümanı gözlemle
        document.addEventListener('DOMContentLoaded', setupEventListeners);
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setupEventListeners();
        }
    }

    // Olay dinleyicilerini ayarla
    function setupEventListeners() {
        // Ctrl+click işlemi için sayfa genelinde event listener
        document.addEventListener('click', function(event) {
            if (event.ctrlKey && event.target.closest('.o_list_table th')) {
                const header = event.target.closest('.o_list_table th');
                const columnIndex = Array.from(header.parentElement.children).indexOf(header);
                const columnName = header.textContent.trim();

                event.preventDefault();
                event.stopPropagation();

                // Sütunun salt okunur olup olmadığını kontrol et
                const isReadOnly = checkIfColumnIsReadOnly(columnIndex);

                if (isReadOnly) {
                    showNotification("Bu sütun salt okunurdur, değişiklik yapamazsınız.", "warning");
                } else {
                    showUpdateDialog(columnIndex, columnName);
                }
            }
        }, true);

        // Değişiklikler için MutationObserver
        const observer = new MutationObserver(function(mutations) {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1 && node.matches('.o_list_view')) {
                            setupListView(node);
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Mevcut liste görünümlerini ayarla
        document.querySelectorAll('.o_list_view').forEach(setupListView);
    }

    // Sütunun salt okunur olup olmadığını kontrol et
    function checkIfColumnIsReadOnly(columnIndex) {
        const table = document.querySelector('.o_list_table');
        if (!table) return false;

        // Tablodaki veri satırlarını al
        const rows = table.querySelectorAll('tbody tr.o_data_row');
        if (rows.length === 0) return false;

        // Sütundaki hücreleri kontrol et
        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (columnIndex < cells.length) {
                const cell = cells[columnIndex];
                // Hücre salt okunur mu kontrol et
                if (cell.classList.contains('o_readonly_modifier')) {
                    return true;
                }
            }
        }

        return false;
    }

    // Liste görünümünü hazırla
    function setupListView(listView) {
        console.log('Liste görünümü bulundu:', listView);
    }

    function showUpdateDialog(columnIndex, columnName) {
        // Önceki diyaloğu kaldır
        const existingDialog = document.querySelector('.bulk-update-dialog');
        if (existingDialog) existingDialog.remove();

        // Görünür satır sayısını al
        const table = document.querySelector('.o_list_table');
        const allRows = Array.from(table.querySelectorAll('tbody tr.o_data_row'));
        const visibleRows = allRows.filter(row => row.style.display !== 'none');

        const dialogPrefix = visibleRows.length !== allRows.length ?
            `<div class="update-info-text">
                <strong>Bilgi:</strong> Tabloda ${allRows.length} satır var ve sadece görünür olan ${visibleRows.length} satır güncellenecektir.
             </div>` : '';

        // Yeni diyalog oluştur
        const dialog = document.createElement('div');
        dialog.className = 'bulk-update-dialog';
        dialog.innerHTML = `
            <h3>${columnName} Sütununu Toplu Güncelleme</h3>
            ${dialogPrefix}
            <div id="singleValueSection">
                <p>Görünür satırlar için yeni değer girin:</p>
                <div class="o_field_widget o_field_char oe_inline" style="display: block; width: 100%;">
                    <input class="o_input" type="text" autocomplete="off" placeholder="Yeni değeri girin..." id="bulkUpdateValue">
                </div>
            </div>
            <div id="multiValueSection" style="display: none;">
                <p>Her satıra bir veri girin:</p>
                <textarea class="bulk-multiline-area" id="bulkUpdateMultilineValue" placeholder="Her satıra bir değer girin..."></textarea>
            </div>
            <br>
            <p>Satırlar arası bekleme süresi (ms cinsinden):</p>
            <div class="o_field_widget o_field_char oe_inline" style="display: block; width: 100%;">
                <input class="o_input" type="number" min="0" autocomplete="off" placeholder="Bekleme süresi girin..." id="bulkUpdateWaitTime" value="300" step="50">
            </div>
            <br>
            <div class="bulk-update-buttons">
                <button class="btn btn-secondary" id="bulkUpdateCancel">İptal</button>
                <button class="btn btn-info" id="bulkUpdateMultiData">Toplu veri aktar</button>
                <button class="btn btn-primary" id="bulkUpdateConfirm">Güncelle</button>
            </div>
        `;
        document.body.appendChild(dialog);

        // Negatif değer girişi engellemek için input event'i ekle
        const waitTimeInput = document.getElementById('bulkUpdateWaitTime');
        waitTimeInput.addEventListener('input', function() {
            if (parseInt(this.value) < 0) {
                this.value = 0;
            }
        });

        // İptal butonu
        document.getElementById('bulkUpdateCancel').addEventListener('click', () => dialog.remove());

        // Toplu veri aktar butonu
        document.getElementById('bulkUpdateMultiData').addEventListener('click', function() {
            // Mevcut görünümü değiştir
            const singleValueSection = document.getElementById('singleValueSection');
            const multiValueSection = document.getElementById('multiValueSection');

            if (singleValueSection.style.display !== 'none') {
                singleValueSection.style.display = 'none';
                multiValueSection.style.display = 'block';
                this.textContent = 'Tek değer girişi';
                document.getElementById('bulkUpdateMultilineValue').focus();
            } else {
                singleValueSection.style.display = 'block';
                multiValueSection.style.display = 'none';
                this.textContent = 'Toplu veri aktar';
                document.getElementById('bulkUpdateValue').focus();
            }
        });

        // Güncelleme işlemini başlatan fonksiyon
        function proceedUpdate() {
            const waitTimeInputValue = document.getElementById('bulkUpdateWaitTime').value;
            if (waitTimeInputValue === "" || isNaN(parseInt(waitTimeInputValue))) {
                showNotification("Lütfen geçerli bir bekleme süresi girin.", "warning");
                return;
            }
            const waitTime = parseInt(waitTimeInputValue);
            if (waitTime < 0) {
                showNotification("Bekleme süresi sıfırdan küçük olamaz.", "warning");
                return;
            }

            // Hangi mod aktif olduğunu kontrol et
            const isMultilineMode = document.getElementById('multiValueSection').style.display !== 'none';

            if (isMultilineMode) {
                // Çoklu veri modu
                const multilineValues = document.getElementById('bulkUpdateMultilineValue').value.split('\n')
                    .filter(line => line.trim() !== ''); // Boş satırları filtrele

                if (multilineValues.length === 0) {
                    showNotification("Lütfen en az bir değer girin.", "warning");
                    return;
                }

                bulkUpdateViaDOM(columnIndex, multilineValues, waitTime, true);
            } else {
                // Tek değer modu
                const newValue = document.getElementById('bulkUpdateValue').value;
                bulkUpdateViaDOM(columnIndex, newValue, waitTime, false);
            }

            dialog.remove();
        }

        // Güncelle butonu
        document.getElementById('bulkUpdateConfirm').addEventListener('click', proceedUpdate);

        // Enter tuşu ile onay
        document.getElementById('bulkUpdateValue').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                proceedUpdate();
            }
        });
        document.getElementById('bulkUpdateWaitTime').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                proceedUpdate();
            }
        });

        // Input odağı
        document.getElementById('bulkUpdateValue').focus();
    }

    // DOM manipülasyonuyla toplu güncelleme - sadece görünür satırları günceller
    async function bulkUpdateViaDOM(columnIndex, newValue, waitTime, isMultiline) {
        const table = document.querySelector('.o_list_table');
        if (!table) {
            showNotification("Liste tablosu bulunamadı!", "error");
            return;
        }

        // İlerleme göstergesi
        const progressDialog = document.createElement('div');
        progressDialog.className = 'd-flex flex-column gap-2 p-3';
        progressDialog.innerHTML = `
            <h3 class="text-center">Toplu Güncelleme İşlemi</h3>
            <div class="progress flex-grow-1 rounded-3">
                <div class="progress-bar progress-bar-striped"
                     role="progressbar"
                     id="odooProgressBar"
                     aria-valuenow="0"
                     aria-valuemin="0"
                     aria-valuemax="100"
                     style="width: 0%">
                    <span class="fs-4">0%</span>
                </div>
            </div>
            <p id="progressStatus" class="text-center mb-0">Hücreler hazırlanıyor...</p>
        `;
        progressDialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0,0,0,0.2);
            min-width: 400px;
            z-index: 10001;
        `;
        document.body.appendChild(progressDialog);

        try {
            // Sadece görünür satırları al
            let allRows = Array.from(table.querySelectorAll('tbody tr.o_data_row'));
            // Sadece görünür satırları filtrele (display: none olmayan)
            let rows = allRows.filter(row => row.style.display !== 'none');
            console.log(`Toplu güncelleme: ${rows.length} görünür satır bulundu (toplam ${allRows.length} satır)`);

            if (rows.length === 0) {
                showNotification("Güncellenecek satır bulunamadı!", "warning");
                progressDialog.remove();
                return;
            }

            let successCount = 0;
            let errorCount = 0;

            // Çoklu değer modunda işlenecek satır sayısını belirle
            let rowsToProcess = rows.length;
            if (isMultiline) {
                // Çoklu değer modunda, giriş yapılan satır sayısı veya mevcut satır sayısından küçük olanı al
                const values = Array.isArray(newValue) ? newValue : [newValue];
                rowsToProcess = Math.min(values.length, rows.length);
            }

            for (let i = 0; i < rowsToProcess; i++) {
                const row = rows[i];
                const cell = row.querySelectorAll('td')[columnIndex];
                if (!cell) continue;

                document.getElementById('progressStatus').textContent = `Satır güncelleniyor: ${i+1}/${rowsToProcess}`;
                const progress = Math.round(((i+1)/rowsToProcess) * 100);
                const progressBar = document.getElementById('odooProgressBar');
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
                progressBar.querySelector('span').textContent = `${progress}%`;

                try {
                    // Hücre salt okunur mu kontrol et
                    if (cell.classList.contains('o_readonly_modifier')) {
                        console.warn("Salt okunur hücre atlanıyor:", cell);
                        continue; // Salt okunur hücreleri atla
                    }

                    // Değer belirleme
                    let valueToUpdate;
                    if (isMultiline && Array.isArray(newValue)) {
                        // Çoklu değer modunda, sıradaki değeri kullan
                        valueToUpdate = newValue[i];
                    } else {
                        // Tek değer modunda, aynı değeri kullan
                        valueToUpdate = newValue;
                    }

                    await updateCell(cell, valueToUpdate);
                    successCount++;
                } catch (error) {
                    console.error(`Hücre güncelleme hatası: ${error.message}`, cell);
                    errorCount++;
                }
                // Kullanıcının belirlediği bekleme süresi
                await sleep(waitTime);
            }

            if (successCount > 0) {
                showNotification(`${successCount} satır başarıyla güncellendi.`, "success");
            } else if (errorCount > 0) {
                showNotification(`Güncelleme başarısız oldu. ${errorCount} hata oluştu.`, "error");
            } else {
                showNotification("Hiçbir satır güncellenemedi.", "warning");
            }

            if (successCount > 0) {
                setTimeout(() => {
                    const event = new KeyboardEvent('keydown', {
                        bubbles: true,
                        cancelable: true,
                        keyCode: 13,
                        code: 'Enter',
                        key: 'Enter'
                    });
                    document.body.dispatchEvent(event);
                }, 500);
            }

        } catch (error) {
            console.error("Toplu güncelleme hatası:", error);
            showNotification("Toplu güncelleme sırasında hata oluştu: " + error.message, "error");
        } finally {
            progressDialog.remove();
        }
    }

    // Hücre güncelleme
    async function updateCell(cell, newValue) {
        return new Promise((resolve, reject) => {
            try {
                // Hücrenin durumunu kontrol et
                const isEditable = cell.classList.contains('o_field_cell') ||
                                  cell.classList.contains('o_data_cell');

                if (!isEditable) {
                    reject(new Error("Bu hücre düzenlenebilir değil"));
                    return;
                }

                // Salt okunur mu kontrol et
                if (cell.classList.contains('o_readonly_modifier')) {
                    reject(new Error("Bu hücre salt okunurdur"));
                    return;
                }

                // 1. Çift tıklama ile edit moda geç
                simulateDoubleClick(cell);

                // 2. Daha uzun bir süre bekleyip input elementini bul
                setTimeout(() => {
                    // Farklı Odoo 17 sürümlerinde farklı editor element yapıları olabilir
                    let input = findInputElement(cell);

                    if (!input) {
                        reject(new Error("Düzenleme alanı bulunamadı. Hücre: " + cell.textContent));
                        return;
                    }

                    // 3. Değeri gir ve değişikliği bildir
                    if (input.type === 'checkbox') {
                        input.checked = (newValue.toLowerCase() === 'true');
                    } else {
                        input.value = newValue;
                    }

                    // 4. Input, change olaylarını tetikle
                    triggerEvent(input, 'input');
                    triggerEvent(input, 'change');

                    // 5. Odak dışına çıkarak (blur) değişikliği uygula
                    setTimeout(() => {
                        triggerEvent(input, 'blur');

                        // 6. Enter tuşuna basarak değişikliği kaydet
                        setTimeout(() => {
                            const enterEvent = new KeyboardEvent('keydown', {
                                bubbles: true,
                                cancelable: true,
                                keyCode: 13,
                                code: 'Enter',
                                key: 'Enter'
                            });
                            input.dispatchEvent(enterEvent);

                            // 7. Başarılı biter
                            resolve();
                        }, 100);
                    }, 100);
                }, 500); // Bekleme süresini 500ms olarak ayarladık

            } catch (error) {
                reject(error);
            }
        });
    }

    // Input elementini bulmak için gelişmiş fonksiyon
    function findInputElement(cell) {
        // 1. Doğrudan hücredeki input alanını ara
        let input = cell.querySelector('input, select, textarea');
        if (input) return input;

        // 2. Widget içindeki input alanını ara
        const widget = cell.querySelector('.o_field_widget');
        if (widget) {
            input = widget.querySelector('input, select, textarea');
            if (input) return input;
        }

        // 3. Aktif/seçili hücredeki input alanını ara
        const activeCell = document.querySelector('.o_selected_cell, .o_editing');
        if (activeCell) {
            input = activeCell.querySelector('input, select, textarea');
            if (input) return input;
        }

        // 4. Özel widget'lar için özel aramalar
        // MANY2ONE fieldları
        if (cell.querySelector('.o_field_many2one')) {
            const many2oneField = cell.querySelector('.o_field_many2one');
            input = many2oneField.querySelector('input.o_input');
            if (input) return input;
        }

        // 5. Daha geniş kapsamlı arama yap - bütün doküman içinde aktif inputları kontrol et
        const allInputs = document.querySelectorAll('input:focus, select:focus, textarea:focus');
        if (allInputs.length > 0) {
            return allInputs[0]; // Aktif olan inputu döndür
        }

        // 6. Modal veya dropdown içindeki input alanlarını kontrol et
        const modalInputs = document.querySelectorAll('.modal input, .dropdown-menu input');
        if (modalInputs.length > 0) {
            return modalInputs[0];
        }

        return null; // Hiçbir input bulunamadı
    }

    // Çift tıklama simülasyonu
    function simulateDoubleClick(element) {
        // MouseEvent ile çift tıklama
        const dblClickEvent = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(dblClickEvent);

        // Alternatif olarak tek tık deneyebiliriz - bazı Odoo sürümlerinde bu gerekebilir
        setTimeout(() => {
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(clickEvent);
        }, 50);
    }

    // Olay tetikleyici
    function triggerEvent(element, eventName) {
        const event = new Event(eventName, { bubbles: true });
        element.dispatchEvent(event);
    }

    // Bekleme yardımcısı
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Bildirim göster
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `bulk-notification bulk-notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // 3 saniye sonra bildirim kaybolsun
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }

    // Scriptı başlat
    initialize();
    console.log("Odoo Toplu Güncelleme scripti başlatıldı");
})();
