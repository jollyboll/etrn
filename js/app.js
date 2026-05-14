// app.js - основная логика приложения

let currentCategory = 'shippers';
let dbSearchTerm = '';

let currentXmlType = 'sbis';

const xmlTypes = {
    sbis: 'СБИС',
    kontur: 'Контур',
    takskom: 'Такском',
    tensor: 'Тензор'
};

// DOM элементы
const generateBtn = document.getElementById('generateBtn');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');
const xmlPreview = document.getElementById('xmlPreview');
const statusMsg = document.getElementById('statusMsg');
const refreshDbBtn = document.getElementById('refreshDbBtn');
const addEntityBtn = document.getElementById('addEntityBtn');
const modal = document.getElementById('entityModal');
const modalTitle = document.getElementById('modalTitle');
const modalFields = document.getElementById('modalFields');
const saveEntityBtn = document.getElementById('saveEntityBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

const inputs = {};
const selectedItems = {};

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function escapeHtml(str) { 
    if (!str) return ''; 
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); 
}

function escapeXml(str) {
    if (!str) return '';
    return str.replace(/[<>&'"]/g, m => {
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '&') return '&amp;';
        if (m === "'") return '&apos;';
        if (m === '"') return '&quot;';
        return m;
    });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================

async function initApp() {
    console.log('initApp started');
    
    if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Проверка авторизации...';
    
    // Проверяем, что window.checkAuth существует (из landing.js)
    if (typeof window.checkAuth !== 'function') {
        console.error('window.checkAuth is not a function. Waiting for landing.js...');
        setTimeout(initApp, 500);
        return;
    }
    
    // Проверяем авторизацию
    try {
        await window.checkAuth();
    } catch (err) {
        console.error('checkAuth error:', err);
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка авторизации';
        return;
    }
    
    if (!currentUser) {
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Требуется авторизация...';
        setTimeout(() => window.location.href = '/etrn/', 1500);
        return;
    }
    
    console.log('User authenticated:', currentUser.email);
    
    const userEmailSpan = document.getElementById('userEmail');
    if (userEmailSpan) userEmailSpan.textContent = currentUser.email;
    
    const isPro = currentUser.subscription_tier === 'pro';
    const subscriptionBadge = document.getElementById('subscriptionBadge');
    const upgradeBanner = document.getElementById('upgradeBanner');
    const cloudBackupBtn = document.getElementById('cloudBackupBtn');
    
    if (subscriptionBadge) {
        subscriptionBadge.textContent = isPro ? 'PRO' : 'Бесплатный';
        subscriptionBadge.classList.toggle('pro', isPro);
    }
    
    if (upgradeBanner) upgradeBanner.style.display = isPro ? 'none' : 'flex';
    if (cloudBackupBtn) cloudBackupBtn.style.display = isPro ? 'inline-block' : 'none';
    
    if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Инициализация базы данных...';
    
    // Инициализируем IndexedDB
    try {
        await initDatabase();
        console.log('Database initialized');
    } catch (err) {
        console.error('Database init error:', err);
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка базы данных';
        return;
    }
    
    createSearchInputs();
    await populateAllSelects();
    await renderDatabasePanel();
    attachEventListeners();
    
    const shipmentDateInput = document.getElementById('shipmentDate');
    if (shipmentDateInput) {
        shipmentDateInput.value = new Date().toISOString().split('T')[0];
    }
    
    if (statusMsg) {
        statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> База данных готова';
        setTimeout(() => { if (statusMsg.innerHTML.includes('готова')) statusMsg.innerHTML = ''; }, 2000);
    }
}

// ==================== СОЗДАНИЕ ПОЛЕЙ ПОИСКА ====================

function createSearchInputs() {
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
    categories.forEach(category => {
        const container = document.getElementById(`${category}Container`);
        if (container) {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `${category}Input`;
            input.className = 'glass-input';
            input.placeholder = '-- Введите для поиска --';
            input.autocomplete = 'off';
            container.innerHTML = '';
            container.appendChild(input);
            inputs[category] = input;
            selectedItems[category] = null;
        }
    });
}

// ==================== ЗАПОЛНЕНИЕ ВЫПАДАЮЩИХ СПИСКОВ ====================

async function populateAllSelects() {
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
    
    for (const category of categories) {
        const items = await getCategory(category);
        const datalistId = `${category}Datalist`;
        
        const oldDatalist = document.getElementById(datalistId);
        if (oldDatalist) oldDatalist.remove();
        
        const datalist = document.createElement('datalist');
        datalist.id = datalistId;
        
        items.forEach(item => {
            const option = document.createElement('option');
            let displayText = '';
            switch(category) {
                case 'shippers': displayText = `${item.name} (${item.inn})`; break;
                case 'consignees': displayText = `${item.name} (${item.inn})`; break;
                case 'carriers': displayText = `${item.name} (${item.inn})`; break;
                case 'drivers': displayText = `${item.fullName} / ${item.license}`; break;
                case 'signers': displayText = `${item.fio} (${item.position})`; break;
                case 'vehicles': displayText = `${item.regNumber} (${item.nationality})`; break;
                case 'products': displayText = item.name; break;
            }
            option.value = displayText;
            option.setAttribute('data-json', JSON.stringify(item));
            datalist.appendChild(option);
        });
        
        document.body.appendChild(datalist);
        
        if (inputs[category]) {
            inputs[category].setAttribute('list', datalistId);
            inputs[category].oninput = function(e) {
                const value = this.value;
                const matchedOption = Array.from(datalist.options).find(opt => opt.value === value);
                if (matchedOption) {
                    selectedItems[category] = JSON.parse(matchedOption.getAttribute('data-json'));
                    if (category === 'products' && selectedItems[category]) {
                        const densityInput = document.getElementById('density');
                        const tnvedInput = document.getElementById('tnvedCode');
                        if (selectedItems[category].densityDefault && densityInput) densityInput.value = selectedItems[category].densityDefault;
                        if (selectedItems[category].defaultTnved && tnvedInput) tnvedInput.value = selectedItems[category].defaultTnved;
                    }
                } else {
                    selectedItems[category] = null;
                }
            };
        }
    }
}

function getSelectedFromSearch(category) {
    return selectedItems[category] || {};
}

// ==================== ПАНЕЛЬ БАЗЫ ДАННЫХ ====================

async function renderDatabasePanel() {
    const dbContent = document.getElementById('dbContent');
    if (!dbContent) return;
    
    dbContent.innerHTML = `
        <div class="db-search-wrapper">
            <input type="text" id="dbSearchInput" class="db-search-input" placeholder="🔍 Поиск по категории..." value="${escapeHtml(dbSearchTerm)}">
        </div>
        <div class="db-category-items" id="dbCategoryItems">
            <div class="loading-spinner">Загрузка...</div>
        </div>
    `;
    
    let items = dbSearchTerm ? await searchInCategory(currentCategory, dbSearchTerm) : await getCategory(currentCategory);
    const itemsContainer = document.getElementById('dbCategoryItems');
    
    if (itemsContainer) {
        if (items.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-state">📭 Нет записей. Нажмите "Добавить"</div>';
        } else {
            itemsContainer.innerHTML = items.map(item => `
                <div class="db-item" data-id="${item.id}" data-category="${currentCategory}">
                    <div class="db-item-info">
                        <strong>${escapeHtml(getItemDisplay(currentCategory, item))}</strong>
                        <small>${escapeHtml(getItemDetails(currentCategory, item))}</small>
                    </div>
                    <button class="delete-item" data-id="${item.id}" data-category="${currentCategory}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `).join('');
        }
    }
    
    const searchInput = document.getElementById('dbSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', async (e) => {
            dbSearchTerm = e.target.value;
            await renderDatabasePanel();
        });
    }
    
    if (itemsContainer) {
        itemsContainer.addEventListener('click', async (e) => {
            const deleteBtn = e.target.closest('.delete-item');
            if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                const category = deleteBtn.dataset.category;
                if (confirm('Удалить запись?')) {
                    await deleteItem(category, id);
                    if (statusMsg) statusMsg.innerHTML = `✅ Удалено из ${getCategoryNameRu(category)}`;
                    await renderDatabasePanel();
                    await populateAllSelects();
                    setTimeout(() => { if (statusMsg && statusMsg.innerHTML.includes('Удалено')) statusMsg.innerHTML = ''; }, 2000);
                }
            }
            
            const itemDiv = e.target.closest('.db-item');
            if (itemDiv && !e.target.closest('.delete-item')) {
                const id = parseInt(itemDiv.dataset.id);
                const category = itemDiv.dataset.category;
                const itemsList = await getCategory(category);
                const found = itemsList.find(i => i.id === id);
                if (found) quickFillByCategory(category, found);
            }
        });
    }
}

function getItemDisplay(category, item) {
    const map = { shippers: 'name', consignees: 'name', carriers: 'name', drivers: 'fullName', signers: 'fio', vehicles: 'regNumber', products: 'name' };
    return item[map[category]] || '';
}

function getItemDetails(category, item) {
    const map = { 
        shippers: `ИНН: ${item.inn || ''}`, 
        consignees: `ИНН: ${item.inn || ''}`, 
        carriers: `ИНН: ${item.inn || ''}`, 
        drivers: `уд. ${item.license || ''}`, 
        signers: item.position || '', 
        vehicles: item.nationality || '', 
        products: `ТН ВЭД: ${item.defaultTnved || ''}` 
    };
    return map[category] || '';
}

function quickFillByCategory(category, data) {
    if (!inputs[category]) return;
    const displayMap = {
        shippers: `${data.name} (${data.inn})`,
        consignees: `${data.name} (${data.inn})`,
        carriers: `${data.name} (${data.inn})`,
        drivers: `${data.fullName} / ${data.license}`,
        signers: `${data.fio} (${data.position})`,
        vehicles: `${data.regNumber} (${data.nationality})`,
        products: data.name
    };
    inputs[category].value = displayMap[category];
    selectedItems[category] = data;
    if (category === 'products') {
        const densityInput = document.getElementById('density');
        const tnvedInput = document.getElementById('tnvedCode');
        if (data.densityDefault && densityInput) densityInput.value = data.densityDefault;
        if (data.defaultTnved && tnvedInput) tnvedInput.value = data.defaultTnved;
    }
}

// ==================== XML ГЕНЕРАЦИЯ ====================

function setXmlType(type) {
    currentXmlType = type;
    if (statusMsg) {
        statusMsg.innerHTML = `<i class="fas fa-check"></i> Выбран формат: ${xmlTypes[type]}`;
        setTimeout(() => { if (statusMsg.innerHTML.includes('Выбран')) statusMsg.innerHTML = ''; }, 1500);
    }
}

function generateXML() {
    try {
        const shipper = getSelectedFromSearch('shippers');
        const consignee = getSelectedFromSearch('consignees');
        const carrier = getSelectedFromSearch('carriers');
        const driver = getSelectedFromSearch('drivers');
        const signer = getSelectedFromSearch('signers');
        const vehicle = getSelectedFromSearch('vehicles');
        const product = getSelectedFromSearch('products');
        
        const weightInput = document.getElementById('weightTons');
        const volumeInput = document.getElementById('volumeLiters');
        const densityInput = document.getElementById('density');
        const tempInput = document.getElementById('tempCelsius');
        const ttnNumberInput = document.getElementById('ttnNumber');
        const shipDateInput = document.getElementById('shipmentDate');
        const shipPointInput = document.getElementById('shipmentPoint');
        
        const weight = parseFloat(weightInput?.value || 0).toFixed(3);
        const volume = parseInt(volumeInput?.value || 0) || 0;
        const density = densityInput?.value || "0.845";
        const temp = tempInput?.value || "18.5";
        const ttnNumber = ttnNumberInput?.value.trim() || `ТТН-${Date.now()}`;
        const shipDate = shipDateInput?.value || new Date().toISOString().split('T')[0];
        const shipPoint = shipPointInput?.value || "Резервуарный парк";
        
        if (!shipper.name) throw new Error("Выберите грузоотправителя");
        if (!consignee.name) throw new Error("Выберите грузополучателя");
        if (!carrier.name) throw new Error("Выберите перевозчика");
        
        const tnved = product.defaultTnved || "2709009009";
        const idGuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (c === 'x' ? Math.random() * 16 | 0 : (Math.random() * 16 | 0) & 0x3 | 0x8).toString(16));
        const nowDate = new Date().toISOString().slice(0, 10);
        
        let xml = '';
        
        switch(currentXmlType) {
            case 'sbis':
                xml = generateSbisXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate);
                break;
            case 'kontur':
                xml = generateKonturXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate);
                break;
            case 'takskom':
                xml = generateTakskomXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate);
                break;
            case 'tensor':
                xml = generateTensorXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate);
                break;
            default:
                xml = generateSbisXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate);
        }
        
        if (xmlPreview) xmlPreview.innerText = xml;
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-check-circle"></i> XML сформирован';
        return xml;
    } catch(e) {
        if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${e.message}`;
        return null;
    }
}

function generateSbisXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ON_TRNACLGROT xmlns="http://www.nalog.ru/EDO/TTN/TransportationCustomer/033/..." ИдОтпр="${idGuid}" ВерсПрог="5.03">
    <КНД>1110339</КНД>
    <ДатаСостав>${nowDate}</ДатаСостав>
    <НомерТТН>${escapeXml(ttnNumber)}</НомерТТН>
    <СвГрузоотпр>
        <ИНН>${escapeXml(shipper.inn || '')}</ИНН>
        <КПП>${escapeXml(shipper.kpp || '')}</КПП>
        <НазваниеОрг>${escapeXml(shipper.name)}</НазваниеОрг>
    </СвГрузоотпр>
    <СвГрузополуч>
        <ИНН>${escapeXml(consignee.inn || '')}</ИНН>
        <КПП>${escapeXml(consignee.kpp || '')}</КПП>
        <НазваниеОрг>${escapeXml(consignee.name)}</НазваниеОрг>
    </СвГрузополуч>
    <СвПеревозч>
        <ИНН>${escapeXml(carrier.inn || '')}</ИНН>
        <КПП>${escapeXml(carrier.kpp || '')}</КПП>
        <НазваниеОрг>${escapeXml(carrier.name)}</НазваниеОрг>
    </СвПеревозч>
    <ТранспСр>
        <РегНомерТС>${escapeXml(vehicle.regNumber || '')}</РегНомерТС>
        <СведВод><ФИОВод>${escapeXml(driver.fullName || '')}</ФИОВод></СведВод>
    </ТранспСр>
    <ТовРаздел>
        <Товар>
            <НаимТов>${escapeXml(product.name || 'Нефть сырая')}</НаимТов>
            <КодТовТНВЭД>${escapeXml(tnved)}</КодТовТНВЭД>
            <КолТов><КолТовФакт>${weight}</КолТовФакт><ОКЕИ>168</ОКЕИ></КолТов>
            <ФизХимПок>
                <Показ><НаимПоказ>Плотность</НаимПоказ><ЗначПоказ>${density}</ЗначПоказ></Показ>
                <Показ><НаимПоказ>Температура</НаимПоказ><ЗначПоказ>${temp}</ЗначПоказ></Показ>
            </ФизХимПок>
        </Товар>
    </ТовРаздел>
    <Подписант><ФИО>${escapeXml(signer.fio || '')}</ФИО></Подписант>
</ON_TRNACLGROT>`;
}

function generateKonturXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Waybill xmlns="http://kontur.ru/edo/ttn" DocId="${idGuid}" Date="${nowDate}" Number="${escapeXml(ttnNumber)}">
    <Consignor>
        <INN>${escapeXml(shipper.inn || '')}</INN>
        <Name>${escapeXml(shipper.name)}</Name>
    </Consignor>
    <Consignee>
        <INN>${escapeXml(consignee.inn || '')}</INN>
        <Name>${escapeXml(consignee.name)}</Name>
    </Consignee>
    <Carrier>
        <INN>${escapeXml(carrier.inn || '')}</INN>
        <Name>${escapeXml(carrier.name)}</Name>
    </Carrier>
    <Vehicle>
        <RegNumber>${escapeXml(vehicle.regNumber || '')}</RegNumber>
        <Driver>${escapeXml(driver.fullName || '')}</Driver>
    </Vehicle>
    <Goods>
        <Name>${escapeXml(product.name || 'Нефть сырая')}</Name>
        <TNVED>${escapeXml(tnved)}</TNVED>
        <Weight>${weight}</Weight>
        <Density>${density}</Density>
        <Temperature>${temp}</Temperature>
    </Goods>
    <Signer>${escapeXml(signer.fio || '')}</Signer>
</Waybill>`;
}

function generateTakskomXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<TTN xmlns="http://takskom.ru/edo/ttn/1.0" Id="${idGuid}" Number="${escapeXml(ttnNumber)}" Date="${nowDate}">
    <Shipper>
        <INN>${escapeXml(shipper.inn || '')}</INN>
        <Organization>${escapeXml(shipper.name)}</Organization>
    </Shipper>
    <Consignee>
        <INN>${escapeXml(consignee.inn || '')}</INN>
        <Organization>${escapeXml(consignee.name)}</Organization>
    </Consignee>
    <Carrier>
        <INN>${escapeXml(carrier.inn || '')}</INN>
        <Organization>${escapeXml(carrier.name)}</Organization>
    </Carrier>
    <Transport>
        <VehicleReg>${escapeXml(vehicle.regNumber || '')}</VehicleReg>
        <DriverName>${escapeXml(driver.fullName || '')}</DriverName>
    </Transport>
    <Cargo>
        <Name>${escapeXml(product.name || 'Нефть сырая')}</Name>
        <TNVEDCode>${escapeXml(tnved)}</TNVEDCode>
        <WeightNet>${weight}</WeightNet>
        <Density>${density}</Density>
        <Temperature>${temp}</Temperature>
    </Cargo>
    <Signatory>${escapeXml(signer.fio || '')}</Signatory>
</TTN>`;
}

function generateTensorXML(shipper, consignee, carrier, driver, signer, vehicle, product, weight, volume, density, temp, ttnNumber, shipDate, shipPoint, tnved, idGuid, nowDate) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="http://tensor.ru/edo/ttn" DocumentID="${idGuid}" DocumentNumber="${escapeXml(ttnNumber)}" DocumentDate="${nowDate}">
    <Sender>
        <INN>${escapeXml(shipper.inn || '')}</INN>
        <Name>${escapeXml(shipper.name)}</Name>
    </Sender>
    <Receiver>
        <INN>${escapeXml(consignee.inn || '')}</INN>
        <Name>${escapeXml(consignee.name)}</Name>
    </Receiver>
    <Transporter>
        <INN>${escapeXml(carrier.inn || '')}</INN>
        <Name>${escapeXml(carrier.name)}</Name>
    </Transporter>
    <VehicleInfo>
        <RegPlate>${escapeXml(vehicle.regNumber || '')}</RegPlate>
        <Driver>${escapeXml(driver.fullName || '')}</Driver>
    </VehicleInfo>
    <ProductInfo>
        <ProductName>${escapeXml(product.name || 'Нефть сырая')}</ProductName>
        <HSECode>${escapeXml(tnved)}</HSECode>
        <Quantity>${weight}</Quantity>
        <Characteristics>
            <Characteristic Name="Плотность">${density}</Characteristic>
            <Characteristic Name="Температура">${temp}</Characteristic>
        </Characteristics>
    </ProductInfo>
    <Signer>${escapeXml(signer.fio || '')}</Signer>
</Document>`;
}

function downloadXML() {
    const xml = generateXML();
    if (xml) {
        const blob = new Blob([xml], {type: 'application/xml'});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const ttnInput = document.getElementById('ttnNumber');
        link.download = `ETRN_${currentXmlType.toUpperCase()}_${ttnInput?.value || 'document'}.xml`;
        link.click();
        URL.revokeObjectURL(link.href);
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-download"></i> Файл скачан';
    }
}

function copyXML() {
    const xml = xmlPreview?.innerText;
    if (xml && !xml.includes('Заполните')) {
        navigator.clipboard.writeText(xml);
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-copy"></i> XML скопирован';
    } else {
        if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Сначала сгенерируйте XML';
    }
}

// ==================== MODAL ====================

function openAddModal() {
    const modalTitleEl = document.getElementById('modalTitle');
    if (modalTitleEl) modalTitleEl.innerText = `Добавить запись: ${getCategoryNameRu(currentCategory)}`;
    
    let fieldsHtml = '';
    switch(currentCategory) {
        case 'shippers':
            fieldsHtml = `<input type="text" id="field_inn" placeholder="ИНН" required><input type="text" id="field_kpp" placeholder="КПП"><input type="text" id="field_name" placeholder="Наименование" required><input type="text" id="field_address" placeholder="Адрес"><input type="text" id="field_phone" placeholder="Телефон">`;
            break;
        case 'consignees':
            fieldsHtml = `<input type="text" id="field_inn" placeholder="ИНН" required><input type="text" id="field_kpp" placeholder="КПП"><input type="text" id="field_name" placeholder="Наименование" required><input type="text" id="field_address" placeholder="Адрес">`;
            break;
        case 'carriers':
            fieldsHtml = `<input type="text" id="field_inn" placeholder="ИНН" required><input type="text" id="field_kpp" placeholder="КПП"><input type="text" id="field_name" placeholder="Наименование" required><input type="text" id="field_transportType" placeholder="Вид транспорта" value="Автомобильный">`;
            break;
        case 'drivers':
            fieldsHtml = `<input type="text" id="field_fullName" placeholder="ФИО" required><input type="text" id="field_license" placeholder="Номер удостоверения" required>`;
            break;
        case 'signers':
            fieldsHtml = `<input type="text" id="field_fio" placeholder="ФИО" required><input type="text" id="field_position" placeholder="Должность" required>`;
            break;
        case 'vehicles':
            fieldsHtml = `<input type="text" id="field_regNumber" placeholder="Рег. номер" required><input type="text" id="field_nationality" placeholder="Национальность" value="RUS">`;
            break;
        case 'products':
            fieldsHtml = `<input type="text" id="field_name" placeholder="Наименование" required><input type="text" id="field_tnved" placeholder="ТН ВЭД" value="2709009009"><input type="text" id="field_density" placeholder="Плотность" value="0.845">`;
            break;
    }
    if (modalFields) modalFields.innerHTML = fieldsHtml;
    if (modal) modal.style.display = 'flex';
}

async function saveNewEntity() {
    const currentItems = await getCategory(currentCategory);
    const limitCheck = await window.checkLimit(currentCategory, currentItems.length);
    
    if (!limitCheck.allowed) {
        const limitModal = document.getElementById('limitModal');
        if (limitModal) limitModal.style.display = 'flex';
        return;
    }
    
    let newItem = {};
    switch(currentCategory) {
        case 'shippers':
            newItem = { inn: document.getElementById('field_inn')?.value || '', kpp: document.getElementById('field_kpp')?.value || '', name: document.getElementById('field_name')?.value || '', address: document.getElementById('field_address')?.value || '', phone: document.getElementById('field_phone')?.value || '' };
            if (!newItem.name || !newItem.inn) { alert('Заполните название и ИНН'); return; }
            break;
        case 'consignees':
            newItem = { inn: document.getElementById('field_inn')?.value || '', kpp: document.getElementById('field_kpp')?.value || '', name: document.getElementById('field_name')?.value || '', address: document.getElementById('field_address')?.value || '' };
            if (!newItem.name) { alert('Заполните название'); return; }
            break;
        case 'carriers':
            newItem = { inn: document.getElementById('field_inn')?.value || '', kpp: document.getElementById('field_kpp')?.value || '', name: document.getElementById('field_name')?.value || '', transportType: document.getElementById('field_transportType')?.value || 'Автомобильный' };
            if (!newItem.name) { alert('Заполните название'); return; }
            break;
        case 'drivers':
            newItem = { fullName: document.getElementById('field_fullName')?.value || '', license: document.getElementById('field_license')?.value || '' };
            if (!newItem.fullName) { alert('Введите ФИО'); return; }
            break;
        case 'signers':
            newItem = { fio: document.getElementById('field_fio')?.value || '', position: document.getElementById('field_position')?.value || '' };
            if (!newItem.fio) { alert('Введите ФИО'); return; }
            break;
        case 'vehicles':
            newItem = { regNumber: document.getElementById('field_regNumber')?.value || '', nationality: document.getElementById('field_nationality')?.value || 'RUS' };
            if (!newItem.regNumber) { alert('Введите госномер'); return; }
            break;
        case 'products':
            newItem = { name: document.getElementById('field_name')?.value || '', defaultTnved: document.getElementById('field_tnved')?.value || '2709009009', densityDefault: document.getElementById('field_density')?.value || '0.845' };
            if (!newItem.name) { alert('Введите наименование'); return; }
            break;
    }
    
    try {
        await addItem(currentCategory, newItem);
        await renderDatabasePanel();
        await populateAllSelects();
        if (modal) modal.style.display = 'none';
        if (statusMsg) {
            statusMsg.innerHTML = `✅ Добавлено в ${getCategoryNameRu(currentCategory)}`;
            setTimeout(() => { if (statusMsg.innerHTML.includes('Добавлено')) statusMsg.innerHTML = ''; }, 2000);
        }
    } catch (error) {
        if (statusMsg) statusMsg.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${error.message}`;
    }
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================

function attachEventListeners() {
    if (generateBtn) generateBtn.addEventListener('click', generateXML);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadXML);
    if (copyBtn) copyBtn.addEventListener('click', copyXML);
    
    if (refreshDbBtn) {
        refreshDbBtn.addEventListener('click', async () => { 
            await renderDatabasePanel(); 
            await populateAllSelects(); 
            if (statusMsg) {
                statusMsg.innerHTML = '<i class="fas fa-sync-alt"></i> Обновлено';
                setTimeout(() => { if (statusMsg.innerHTML.includes('Обновлено')) statusMsg.innerHTML = ''; }, 1500);
            }
        });
    }
    
    if (addEntityBtn) addEntityBtn.addEventListener('click', openAddModal);
    
    const exportAllBtn = document.getElementById('exportAllBtn');
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', async () => { 
            await exportAllToFiles(); 
            if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-download"></i> Экспорт завершен'; 
        });
    }
    
    const importAllBtn = document.getElementById('importAllBtn');
    if (importAllBtn) {
        importAllBtn.addEventListener('click', () => { 
            const input = document.createElement('input'); 
            input.type = 'file'; 
            input.multiple = true; 
            input.accept = '.json'; 
            input.onchange = async (e) => { 
                await importAllFromFiles(Array.from(e.target.files)); 
                await renderDatabasePanel(); 
                await populateAllSelects(); 
                if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-check"></i> Импорт завершен'; 
            }; 
            input.click(); 
        });
    }
    
    const clearStorageBtn = document.getElementById('clearStorageBtn');
    if (clearStorageBtn) {
        clearStorageBtn.addEventListener('click', async () => { 
            if (confirm('Удалить все данные?')) { 
                await clearAllDatabase(); 
                await renderDatabasePanel(); 
                await populateAllSelects(); 
                if (statusMsg) statusMsg.innerHTML = '<i class="fas fa-check"></i> База очищена'; 
            } 
        });
    }
    
    if (saveEntityBtn) saveEntityBtn.addEventListener('click', saveNewEntity);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    
    document.querySelectorAll('.db-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.db-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentCategory = tab.dataset.category;
            dbSearchTerm = '';
            await renderDatabasePanel();
        });
    });
    
    document.querySelectorAll('input[name="xmlType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                setXmlType(e.target.dataset.type);
            }
        });
    });
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => { 
            if (confirm('Выйти из аккаунта?')) {
                await window.logout();
            }
        });
    }
    
    const upgradeLink = document.getElementById('upgradeLink');
    if (upgradeLink) {
        upgradeLink.addEventListener('click', () => alert('ПРО версия: неограниченное количество контрагентов. Свяжитесь: pro@neftetrade.ru'));
    }
    
    const limitUpgradeBtn = document.getElementById('limitUpgradeBtn');
    if (limitUpgradeBtn) {
        limitUpgradeBtn.addEventListener('click', () => { 
            const limitModal = document.getElementById('limitModal');
            if (limitModal) limitModal.style.display = 'none'; 
            alert('ПРО версия: неограниченное количество контрагентов. Свяжитесь: pro@neftetrade.ru'); 
        });
    }
    
    const limitCloseBtn = document.getElementById('limitCloseBtn');
    if (limitCloseBtn) {
        limitCloseBtn.addEventListener('click', () => { 
            const limitModal = document.getElementById('limitModal');
            if (limitModal) limitModal.style.display = 'none'; 
        });
    }
    
    const weightInput = document.getElementById('weightTons');
    const volumeInput = document.getElementById('volumeLiters');
    const densityInput = document.getElementById('density');
    
    if (weightInput && volumeInput && densityInput) {
        const calculateVolume = () => {
            const weight = parseFloat(weightInput.value);
            const density = parseFloat(densityInput.value);
            if (!isNaN(weight) && !isNaN(density) && density > 0 && !volumeInput.value) {
                volumeInput.value = (weight / density * 1000).toFixed(0);
            }
        };
        weightInput.addEventListener('input', calculateVolume);
        densityInput.addEventListener('input', calculateVolume);
    }
}

// ==================== ЗАПУСК ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting app...');
    initApp();
});

console.log('✅ app.js loaded');
