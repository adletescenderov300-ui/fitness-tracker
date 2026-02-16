/**
 * Fitness Tracker - Main Application
 * @version 1.0.0
 */

import { TelegramCore } from './core/telegram.js';
import { StorageCore } from './core/storage.js';
import { GitHubLoader } from './core/github.js';

// Конфигурация
const CONFIG = {
    github: {
        owner: 'adletescenderov300-ui', // ⚠️ ЗАМЕНИТЬ
        repo: 'fitness-content', // ⚠️ ЗАМЕНИТЬ
        branch: 'main'
    }
};

// Состояние приложения
const state = {
    user: null,
    content: {
        exercises: [],
        programs: [],
        articles: [],
        version: null
    },
    ui: {
        currentScreen: 'loading',
        loading: true
    }
};

// Инициализация модулей
let telegram, storage, github;

// DOM элементы
const root = document.getElementById('root');

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

async function initApp() {
    console.log('🚀 Fitness Tracker инициализация...');
    
    try {
        // 1. Telegram
        telegram = new TelegramCore();
        state.user = telegram.getUser();
        
        // 2. Storage
        storage = new StorageCore(telegram);
        
        // 3. GitHub Loader
        github = new GitHubLoader(CONFIG.github);
        
        // 4. Загружаем сохраненные данные пользователя
        await loadUserData();
        
        // 5. Загружаем контент с GitHub
        await loadContent();
        
        // 6. Проверяем обновления
        await checkContentUpdates();
        
        // 7. Рендерим главный экран
        renderMainScreen();
        
        console.log('✅ Приложение готово', state);
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showErrorScreen('Не удалось запустить приложение');
    }
}

// Загрузка пользовательских данных из Telegram Cloud
async function loadUserData() {
    // Загружаем настройки
    const settings = await storage.get('settings', {
        weightUnit: 'kg',
        theme: 'dark',
        restTimer: 90,
        autoProgression: true
    });
    
    // Загружаем историю тренировок
    const workouts = await storage.get('workouts', []);
    
    // Загружаем пользовательские программы
    const customPrograms = await storage.get('customPrograms', []);
    
    // Загружаем пользовательские упражнения
    const customExercises = await storage.get('customExercises', []);
    
    // Сохраняем в состояние
    state.userData = {
        settings,
        workouts,
        customPrograms,
        customExercises
    };
    
    console.log('📦 Данные пользователя загружены:', {
        workouts: workouts.length,
        programs: customPrograms.length,
        exercises: customExercises.length
    });
}

// Загрузка контента с GitHub
async function loadContent() {
    // Пытаемся загрузить из кэша сначала
    const cachedVersion = await storage.get('contentVersion');
    const cachedExercises = await storage.get('cachedExercises');
    const cachedPrograms = await storage.get('cachedPrograms');
    
    if (cachedExercises && cachedPrograms && cachedVersion) {
        state.content.exercises = cachedExercises;
        state.content.programs = cachedPrograms;
        state.content.version = cachedVersion;
        console.log('📚 Контент загружен из кэша');
        return;
    }
    
    // Иначе грузим с GitHub
    try {
        const [exercises, programs, version] = await Promise.all([
            github.loadAllExercises(),
            github.loadAllPrograms(),
            github.getContentVersion()
        ]);
        
        state.content.exercises = exercises;
        state.content.programs = programs;
        state.content.version = version;
        
        // Сохраняем в кэш
        await storage.set('cachedExercises', exercises);
        await storage.set('cachedPrograms', programs);
        await storage.set('contentVersion', version);
        
        console.log('📚 Контент загружен с GitHub:', {
            exercises: exercises.length,
            programs: programs.length,
            version
        });
        
    } catch (error) {
        console.error('Ошибка загрузки контента:', error);
        // Если ничего не загрузилось, показываем ошибку
        if (!state.content.exercises.length) {
            throw new Error('Не удалось загрузить базу упражнений');
        }
    }
}

// Проверка обновлений контента
async function checkContentUpdates() {
    const updateCheck = await github.checkForUpdates(state.content.version);
    
    if (updateCheck.hasUpdates) {
        console.log('🔄 Доступны обновления контента');
        
        // Показываем уведомление пользователю
        if (telegram.tg) {
            telegram.showConfirm('Доступны новые упражнения и программы. Обновить?')
                .then(async (confirmed) => {
                    if (confirmed) {
                        await loadContent(); // Перезагружаем
                        renderMainScreen(); // Обновляем интерфейс
                    }
                });
        }
    }
}

// ============================================
// РЕНДЕРИНГ ЭКРАНОВ
// ============================================

function renderMainScreen() {
    const html = `
        <div class="app">
            <!-- Шапка -->
            <header class="header safe-top" style="padding-top: 16px;">
                <h1>Тренировки</h1>
                <div class="header-right">
                    <span class="avatar" onclick="navigateToProfile()">
                        ${state.user?.firstName?.[0] || 'A'}
                    </span>
                </div>
            </header>

            <!-- Сегодняшняя тренировка -->
            <section class="today-workout fade-in">
                <h2>Сегодня</h2>
                <div class="workout-card" onclick="startWorkout()">
                    <div class="workout-card-header">
                        <span class="workout-name">${getTodaysWorkout()}</span>
                        <span class="workout-icon">→</span>
                    </div>
                    <div class="workout-stats">
                        <span>${getExercisesCount()} упражнений</span>
                        <span>•</span>
                        <span>${getLastWorkoutTime()}</span>
                    </div>
                </div>
            </section>

            <!-- Быстрые действия -->
            <section class="quick-actions">
                <button class="action-button" onclick="startEmptyWorkout()">
                    <span class="action-icon">+</span>
                    <span>Свободная тренировка</span>
                </button>
                <button class="action-button" onclick="navigateToPrograms()">
                    <span class="action-icon">📋</span>
                    <span>Программы</span>
                </button>
            </section>

            <!-- Последние тренировки -->
            <section class="recent-workouts">
                <h3>Последние</h3>
                ${renderRecentWorkouts()}
            </section>

            <!-- Прогресс (кратко) -->
            <section class="progress-preview">
                <h3>Прогресс</h3>
                <div class="progress-bars">
                    ${renderProgressBars()}
                </div>
            </section>

            <!-- Нижняя навигация -->
            <nav class="tab-bar">
                <div class="tab-item active" onclick="navigateTo('home')">
                    <span class="tab-icon">🏠</span>
                    <span>Главная</span>
                </div>
                <div class="tab-item" onclick="navigateTo('programs')">
                    <span class="tab-icon">📋</span>
                    <span>Программы</span>
                </div>
                <div class="tab-item" onclick="navigateTo('exercises')">
                    <span class="tab-icon">💪</span>
                    <span>Упражнения</span>
                </div>
                <div class="tab-item" onclick="navigateTo('stats')">
                    <span class="tab-icon">📊</span>
                    <span>Статистика</span>
                </div>
                <div class="tab-item" onclick="navigateTo('profile')">
                    <span class="tab-icon">👤</span>
                    <span>Профиль</span>
                </div>
            </nav>
        </div>
    `;
    
    root.innerHTML = html;
    
    // Анимируем появление
    setTimeout(() => {
        document.querySelector('.fade-in')?.classList.add('visible');
    }, 100);
}

// Вспомогательные функции рендеринга
function renderRecentWorkouts() {
    const workouts = state.userData?.workouts?.slice(-3) || [];
    
    if (workouts.length === 0) {
        return '<div class="empty-state">Нет тренировок</div>';
    }
    
    return workouts.reverse().map(workout => `
        <div class="workout-history-item" onclick="viewWorkout('${workout.id}')">
            <div class="workout-history-date">${formatDate(workout.date)}</div>
            <div class="workout-history-name">${workout.name || 'Тренировка'}</div>
            <div class="workout-history-stats">${workout.exercises?.length || 0} упр</div>
        </div>
    `).join('');
}

function renderProgressBars() {
    // Топ-3 упражнения для прогресса
    const topExercises = ['Жим лежа', 'Приседания', 'Становая тяга'];
    
    return topExercises.map(exercise => `
        <div class="progress-item">
            <span class="progress-label">${exercise}</span>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: 75%"></div>
            </div>
        </div>
    `).join('');
}

// ============================================
// НАВИГАЦИЯ
// ============================================

window.navigateTo = (screen) => {
    console.log('Навигация:', screen);
    // Будет реализовано позже
};

window.navigateToProfile = () => navigateTo('profile');
window.navigateToPrograms = () => navigateTo('programs');

window.startWorkout = () => {
    telegram.hapticFeedback('medium');
    console.log('Старт тренировки');
    // Будет реализовано в следующем модуле
};

window.startEmptyWorkout = () => {
    telegram.hapticFeedback('medium');
    console.log('Старт свободной тренировки');
};

window.viewWorkout = (id) => {
    telegram.hapticFeedback('light');
    console.log('Просмотр тренировки:', id);
};

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function getTodaysWorkout() {
    // Определяем тренировку по программе
    return 'Грудь + Трицепс';
}

function getExercisesCount() {
    return 6;
}

function getLastWorkoutTime() {
    return '2 дня назад';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ============================================
// ЭКРАН ОШИБКИ
// ============================================

function showErrorScreen(message) {
    root.innerHTML = `
        <div class="app error-screen">
            <div class="error-icon">⚠️</div>
            <h2>Ошибка</h2>
            <p>${message}</p>
            <button class="button" onclick="location.reload()">
                Попробовать снова
            </button>
        </div>
    `;
}

// ============================================
// СТАРТ
// ============================================
document.addEventListener('DOMContentLoaded', initApp);

// Добавляем стили для новых элементов (временно добавим в head)
const style = document.createElement('style');
style.textContent = `
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 0;
    }
    
    .avatar {
        width: 40px;
        height: 40px;
        border-radius: 20px;
        background: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 18px;
    }
    
    .workout-card {
        background: linear-gradient(145deg, var(--surface), var(--surface-secondary));
        border-radius: 24px;
        padding: 20px;
        margin: 16px 0;
        transition: all 0.2s var(--ease);
        cursor: pointer;
    }
    
    .workout-card:active {
        transform: scale(0.98);
        opacity: 0.9;
    }
    
    .workout-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .workout-name {
        font-size: 20px;
        font-weight: 600;
    }
    
    .workout-icon {
        font-size: 24px;
        color: var(--text-secondary);
    }
    
    .workout-stats {
        display: flex;
        gap: 8px;
        color: var(--text-secondary);
        font-size: 15px;
    }
    
    .quick-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin: 24px 0;
    }
    
    .action-button {
        background: var(--surface);
        border: none;
        border-radius: 16px;
        padding: 16px;
        color: var(--text-primary);
        font-size: 15px;
        font-weight: 500;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.2s var(--ease);
    }
    
    .action-button:active {
        background: var(--surface-secondary);
        transform: scale(0.97);
    }
    
    .action-icon {
        font-size: 24px;
    }
    
    .workout-history-item {
        background: var(--surface);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        transition: all 0.2s var(--ease);
    }
    
    .workout-history-item:active {
        background: var(--surface-secondary);
    }
    
    .workout-history-date {
        color: var(--text-secondary);
        font-size: 14px;
    }
    
    .workout-history-name {
        font-weight: 500;
    }
    
    .workout-history-stats {
        color: var(--text-tertiary);
        font-size: 14px;
    }
    
    .empty-state {
        text-align: center;
        padding: 32px;
        color: var(--text-secondary);
        background: var(--surface);
        border-radius: 16px;
    }
    
    .progress-preview {
        margin: 24px 0 80px 0;
    }
    
    .progress-item {
        margin-bottom: 16px;
    }
    
    .progress-label {
        display: block;
        margin-bottom: 6px;
        color: var(--text-secondary);
        font-size: 14px;
    }
    
    .progress-bar-bg {
        height: 8px;
        background: var(--surface);
        border-radius: 4px;
        overflow: hidden;
    }
    
    .progress-bar-fill {
        height: 100%;
        background: var(--accent);
        border-radius: 4px;
        transition: width 0.3s var(--spring);
    }
    
    .error-screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        text-align: center;
        gap: 20px;
    }
    
    .error-icon {
        font-size: 64px;
        margin-bottom: 16px;
    }
`;

document.head.appendChild(style);
