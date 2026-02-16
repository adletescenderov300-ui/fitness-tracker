/**
 * Telegram Cloud Storage Module
 * @version 1.0.0
 * Отвечает за синхронизацию данных пользователя
 */

export class StorageCore {
    constructor(telegram) {
        this.tg = telegram.tg;
        this.user = telegram.getUser();
        this.cache = new Map();
        this.storageAvailable = !!this.tg?.CloudStorage;
        
        console.log('StorageCore инициализирован', {
            available: this.storageAvailable,
            userId: this.user?.id
        });
    }

    // Сохранить данные в Cloud Storage
    async set(key, value) {
        if (!this.storageAvailable) {
            // Fallback на localStorage
            localStorage.setItem(`fitness_${key}`, JSON.stringify(value));
            this.cache.set(key, value);
            return true;
        }

        try {
            const stringValue = typeof value === 'string' 
                ? value 
                : JSON.stringify(value);
            
            await this._promisifyStorage(
                this.tg.CloudStorage.setItem,
                key,
                stringValue
            );
            
            this.cache.set(key, value);
            return true;
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            return false;
        }
    }

    // Получить данные из Cloud Storage
    async get(key, defaultValue = null) {
        // Проверяем кэш
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        if (!this.storageAvailable) {
            // Fallback на localStorage
            const local = localStorage.getItem(`fitness_${key}`);
            if (local) {
                try {
                    const parsed = JSON.parse(local);
                    this.cache.set(key, parsed);
                    return parsed;
                } catch {
                    return local;
                }
            }
            return defaultValue;
        }

        try {
            const value = await this._promisifyStorage(
                this.tg.CloudStorage.getItem,
                key
            );
            
            if (value === null || value === undefined) {
                return defaultValue;
            }

            // Пробуем распарсить JSON
            try {
                const parsed = JSON.parse(value);
                this.cache.set(key, parsed);
                return parsed;
            } catch {
                this.cache.set(key, value);
                return value;
            }
        } catch (error) {
            console.error('Ошибка загрузки:', error);
            return defaultValue;
        }
    }

    // Удалить данные
    async remove(key) {
        if (!this.storageAvailable) {
            localStorage.removeItem(`fitness_${key}`);
        } else {
            await this._promisifyStorage(
                this.tg.CloudStorage.removeItem,
                key
            );
        }
        this.cache.delete(key);
    }

    // Получить все ключи
    async keys() {
        if (!this.storageAvailable) {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('fitness_')) {
                    keys.push(key.replace('fitness_', ''));
                }
            }
            return keys;
        }

        try {
            return await this._promisifyStorage(
                this.tg.CloudStorage.getKeys
            );
        } catch {
            return [];
        }
    }

    // Конвертируем колбэк Cloud Storage в Promise
    _promisifyStorage(method, ...args) {
        return new Promise((resolve, reject) => {
            method.call(this.tg.CloudStorage, ...args, (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    // Экспорт всех данных пользователя
    async exportAll() {
        const keys = await this.keys();
        const data = {};
        
        for (const key of keys) {
            data[key] = await this.get(key);
        }
        
        return data;
    }

    // Импорт данных
    async importAll(data) {
        for (const [key, value] of Object.entries(data)) {
            await this.set(key, value);
        }
        return true;
    }
}
