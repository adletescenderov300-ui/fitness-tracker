/**
 * GitHub Content Loader Module
 * @version 1.0.0
 * Загружает упражнения, программы и статьи с GitHub
 */

export class GitHubLoader {
    constructor(config) {
        this.owner = config.owner;
        this.repo = config.repo;
        this.branch = config.branch || 'main';
        this.baseUrl = `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}`;
        this.apiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/contents`;
        
        // Кэш для загруженных данных
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 минут
    }

    // Загрузить JSON-файл
    async fetchJSON(path) {
        const cacheKey = `github_${path}`;
        const cached = this.cache.get(cacheKey);
        
        // Проверяем кэш
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            const url = `${this.baseUrl}/${path}`;
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            // Сохраняем в кэш
            this.cache.set(cacheKey, {
                data,
                timestamp: Date.now()
            });

            return data;
        } catch (error) {
            console.error(`Ошибка загрузки ${path}:`, error);
            return null;
        }
    }

    // Загрузить Markdown/текст
    async fetchText(path) {
        try {
            const url = `${this.baseUrl}/${path}`;
            const response = await fetch(url);
            return await response.text();
        } catch (error) {
            console.error(`Ошибка загрузки текста ${path}:`, error);
            return null;
        }
    }

    // Загрузить список файлов в директории (через API)
    async listFiles(directory, extension = null) {
        try {
            const url = `${this.apiUrl}/${directory}`;
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) return [];

            const files = await response.json();
            
            if (!Array.isArray(files)) return [];

            return files
                .filter(file => file.type === 'file')
                .filter(file => !extension || file.name.endsWith(extension))
                .map(file => ({
                    name: file.name,
                    path: file.path,
                    downloadUrl: file.download_url,
                    size: file.size
                }));
        } catch (error) {
            console.error('Ошибка получения списка файлов:', error);
            return [];
        }
    }

    // Загрузить все упражнения
    async loadAllExercises() {
        // Пытаемся загрузить индексы
        const index = await this.fetchJSON('exercises/index.json');
        
        if (index && index.exercises) {
            // Если есть индексный файл, используем его
            return index.exercises;
        }

        // Иначе загружаем все JSON из папки exercises
        const files = await this.listFiles('exercises', '.json');
        const exercises = [];

        for (const file of files) {
            if (file.name === 'index.json') continue;
            
            const data = await this.fetchJSON(file.path);
            if (data) {
                exercises.push({
                    ...data,
                    id: file.name.replace('.json', '')
                });
            }
        }

        return exercises;
    }

    // Загрузить все программы
    async loadAllPrograms() {
        const index = await this.fetchJSON('programs/index.json');
        
        if (index && index.programs) {
            return index.programs;
        }

        const files = await this.listFiles('programs', '.json');
        const programs = [];

        for (const file of files) {
            if (file.name === 'index.json') continue;
            
            const data = await this.fetchJSON(file.path);
            if (data) {
                programs.push({
                    ...data,
                    id: file.name.replace('.json', '')
                });
            }
        }

        return programs;
    }

    // Получить версию контента
    async getContentVersion() {
        const versionFile = await this.fetchJSON('version.json');
        return versionFile?.version || '1.0.0';
    }

    // Загрузить статью
    async loadArticle(articleId) {
        const article = await this.fetchJSON(`articles/${articleId}.json`);
        if (article) return article;

        // Fallback на Markdown
        const markdown = await this.fetchText(`articles/${articleId}.md`);
        if (markdown) {
            return {
                id: articleId,
                content: markdown,
                format: 'markdown'
            };
        }

        return null;
    }

    // Проверить обновления контента
    async checkForUpdates(localVersion) {
        const remoteVersion = await this.getContentVersion();
        return {
            hasUpdates: remoteVersion !== localVersion,
            localVersion,
            remoteVersion
        };
    }

    // Очистить кэш
    clearCache() {
        this.cache.clear();
    }
}
