// database.js - управление базой данных через IndexedDB + Dexie.js

// Создаем экземпляр базы данных
const db = new Dexie('ETRN_Database');

// Определяем схему базы данных
db.version(1).stores({
    shippers: '++id, inn, name, kpp, address, phone',
    consignees: '++id, inn, name, kpp, address',
    carriers: '++id, inn, name, kpp, transportType',
    drivers: '++id, fullName, license',
    signers: '++id, fio, position',
    vehicles: '++id, regNumber, nationality',
    products: '++id, name, defaultTnved, densityDefault'
});

// Данные по умолчанию
const DEFAULT_DATA = {
    shippers: [
        { inn: "772345678901", kpp: "772301001", name: "ООО \"НефтеТрейд\"", address: "г. Москва, ул. Промышленная, д.15", phone: "74951234567" }
    ],
    consignees: [
        { inn: "504712345678", kpp: "504701001", name: "АО \"НефтеПереработка\"", address: "Московская обл., г. Химки, ул. Заводская, д.1" }
    ],
    carriers: [
        { inn: "771234567890", kpp: "771201001", name: "ООО \"ТрансЛогистик\"", transportType: "Автомобильный" }
    ],
    drivers: [
        { fullName: "Петров Иван Васильевич", license: "99 25 123456" }
    ],
    signers: [
        { fio: "Сидоров Алексей Михайлович", position: "Генеральный директор" }
    ],
    vehicles: [
        { regNumber: "А123ВЕ777", nationality: "RUS" }
    ],
    products: [
        { name: "Нефть сырая", defaultTnved: "2709009009", densityDefault: "0.845" }
    ]
};

// Флаг инициализации
let isInitialized = false;

// Инициализация базы данных
async function initDatabase() {
    if (isInitialized) return;
    
    try {
        // Проверяем, есть ли данные в каждой таблице
        for (const [tableName, defaultData] of Object.entries(DEFAULT_DATA)) {
            const count = await db[tableName].count();
            if (count === 0) {
                // Добавляем данные по умолчанию
                const itemsWithIds = defaultData.map(item => ({ ...item }));
                await db[tableName].bulkAdd(itemsWithIds);
                console.log(`✅ Добавлены данные по умолчанию в ${tableName}`);
            }
        }
        isInitialized = true;
        console.log('✅ База данных IndexedDB инициализирована');
    } catch (error) {
        console.error('Ошибка инициализации базы:', error);
    }
}

// Получение всех записей из категории
async function getCategory(category) {
    try {
        return await db[category].toArray();
    } catch (error) {
        console.error(`Ошибка получения ${category}:`, error);
        return [];
    }
}

// Поиск в категории
async function searchInCategory(category, searchText) {
    try {
        if (!searchText || searchText.trim() === '') {
            return await db[category].toArray();
        }
        
        const items = await db[category].toArray();
        const searchLower = searchText.toLowerCase();
        
        // Поиск по текстовым полям
        return items.filter(item => {
            // Поиск по имени/названию
            const nameField = item.name || item.fullName || item.fio || item.regNumber;
            if (nameField && nameField.toLowerCase().includes(searchLower)) return true;
            
            // Поиск по ИНН
            if (item.inn && item.inn.toLowerCase().includes(searchLower)) return true;
            
            // Поиск по номеру удостоверения
            if (item.license && item.license.toLowerCase().includes(searchLower)) return true;
            
            return false;
        });
    } catch (error) {
        console.error(`Ошибка поиска в ${category}:`, error);
        return [];
    }
}

// Добавление записи
async function addItem(category, item) {
    try {
        const id = await db[category].add(item);
        return { ...item, id };
    } catch (error) {
        console.error(`Ошибка добавления в ${category}:`, error);
        throw error;
    }
}

// Удаление записи
async function deleteItem(category, id) {
    try {
        await db[category].delete(id);
        return true;
    } catch (error) {
        console.error(`Ошибка удаления из ${category}:`, error);
        throw error;
    }
}

// Обновление записи
async function updateItem(category, id, item) {
    try {
        await db[category].update(id, item);
        return true;
    } catch (error) {
        console.error(`Ошибка обновления в ${category}:`, error);
        throw error;
    }
}

// Экспорт всей базы в JSON файлы
async function exportAllToFiles() {
    try {
        const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
        
        for (const category of categories) {
            const data = await db[category].toArray();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = `${category}.json`;
            link.click();
            URL.revokeObjectURL(url);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        throw error;
    }
}

// Импорт данных из JSON файла
async function importFromFile(category, file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    // Очищаем таблицу и добавляем новые данные
                    await db[category].clear();
                    await db[category].bulkAdd(data);
                    resolve(data.length);
                } else {
                    reject(new Error('Неверный формат файла'));
                }
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

// Импорт всех файлов
async function importAllFromFiles(files) {
    let importedCount = 0;
    for (const file of files) {
        const category = file.name.replace('.json', '');
        if (db[category]) {
            try {
                const count = await importFromFile(category, file);
                importedCount++;
                console.log(`Импортировано ${count} записей в ${category}`);
            } catch (error) {
                console.error(`Ошибка импорта ${file.name}:`, error);
            }
        }
    }
    return importedCount;
}

// Очистка всей базы данных
async function clearAllDatabase() {
    try {
        const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
        for (const category of categories) {
            await db[category].clear();
        }
        console.log('✅ База данных очищена');
        return true;
    } catch (error) {
        console.error('Ошибка очистки базы:', error);
        throw error;
    }
}

// Сброс к данным по умолчанию
async function resetToDefault() {
    try {
        await clearAllDatabase();
        
        for (const [tableName, defaultData] of Object.entries(DEFAULT_DATA)) {
            const itemsWithIds = defaultData.map(item => ({ ...item }));
            await db[tableName].bulkAdd(itemsWithIds);
        }
        
        console.log('✅ База данных сброшена к значениям по умолчанию');
        return true;
    } catch (error) {
        console.error('Ошибка сброса базы:', error);
        throw error;
    }
}

// Получение статистики базы
async function getDatabaseStats() {
    const stats = {};
    const categories = ['shippers', 'consignees', 'carriers', 'drivers', 'signers', 'vehicles', 'products'];
    
    for (const category of categories) {
        const count = await db[category].count();
        stats[category] = count;
    }
    
    return stats;
}

// Получение названия категории на русском
function getCategoryNameRu(category) {
    const names = {
        shippers: 'Грузоотправители',
        consignees: 'Грузополучатели',
        carriers: 'Перевозчики',
        drivers: 'Водители',
        signers: 'Подписанты',
        vehicles: 'Транспорт',
        products: 'Продукты'
    };
    return names[category] || category;
}
