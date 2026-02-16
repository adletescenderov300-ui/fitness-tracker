/**
 * Telegram Mini App Core Module
 * @version 1.0.0
 * Отвечает за взаимодействие с Telegram
 */

export class TelegramCore {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        if (!this.tg) {
            console.error('Telegram WebApp не доступен');
            return;
        }

        this.init();
    }

    init() {
        // Настраиваем внешний вид
        this.tg.setHeaderColor('#000000');
        this.tg.setBackgroundColor('#000000');
        
        // Разворачиваем на весь экран
        this.tg.expand();
        
        // Отключаем вертикальные свайпы (чтобы не выходили из приложения)
        this.tg.disableVerticalSwipes?.();
        
        console.log('Telegram Core инициализирован', {
            initData: this.tg.initData,
            platform: this.tg.platform,
            version: this.tg.version
        });
    }

    // Получить данные пользователя
    getUser() {
        if (!this.tg?.initDataUnsafe?.user) return null;
        
        const user = this.tg.initDataUnsafe.user;
        return {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username,
            languageCode: user.language_code,
            photoUrl: `https://t.me/i/userpic/320/${user.username}.jpg` // Стандартный URL аватарки
        };
    }

    // Показать всплывающее уведомление
    showAlert(message) {
        this.tg?.showAlert(message);
    }

    // Показать подтверждение
    showConfirm(message) {
        return this.tg?.showConfirm(message);
    }

    // Отправить данные обратно в бота (если нужно)
    sendData(data) {
        this.tg?.sendData(JSON.stringify(data));
    }

    // Закрыть приложение
    close() {
        this.tg?.close();
    }

    // Вибрация (если поддерживается)
    hapticFeedback(style = 'medium') {
        try {
            this.tg?.HapticFeedback?.impactOccurred(style);
        } catch (e) {
            // Игнорируем, если не поддерживается
        }
    }
}
