class Translyte {
    constructor(options = {}) {
        this.apiEndpoint = options.apiEndpoint || '/api';
        this.baseLanguage = options.baseLanguage || 'en';
        this.context = options.context || 'A web application interface';
        this.pathStructure = options.pathStructure || '{{lng}}/{{ns}}.json';
        this._sessionCache = new Map();
    }

    _buildPath(language, namespace) {
        if (!this.pathStructure.includes('{{lng}}')) {
            throw new Error("Translyte config error: pathStructure must include '{{lng}}'.");
        }
        return this.pathStructure
            .replace(/{{lng}}/g, language)
            .replace(/{{ns}}/g, namespace);
    }

    async getTranslations(language, namespace = 'common') {
        const finalPath = this._buildPath(language, namespace);
        if (this._sessionCache.has(finalPath)) {
            return this._sessionCache.get(finalPath);
        }
        try {
            const translations = await this._fetchFromServer(finalPath);
            this._sessionCache.set(finalPath, translations);
            return translations;
        } catch (error) {
            if (error.status === 404) {
                console.warn(`Translyte: No file for '${finalPath}'. Generating...`);
                const newTranslations = await this._generateAndSaveTranslations(language, namespace);
                this._sessionCache.set(finalPath, newTranslations);
                return newTranslations;
            }
            throw error;
        }
    }

    async _fetchFromServer(filePath) {
        const response = await fetch(`${this.apiEndpoint}/translations/${filePath}`);
        if (!response.ok) {
            const error = new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
            error.status = response.status;
            throw error;
        }
        return response.json();
    }

    async _generateAndSaveTranslations(targetLanguage, namespace) {
        const basePath = this._buildPath(this.baseLanguage, namespace);
        const baseTranslations = await this._fetchFromServer(basePath);
        const newTranslations = await this._generateViaProxy(targetLanguage, baseTranslations);
        const targetPath = this._buildPath(targetLanguage, namespace);
        await this._saveToServer(targetPath, newTranslations);
        return newTranslations;
    }

    async _generateViaProxy(targetLanguage, baseTranslations) {
        const response = await fetch(`${this.apiEndpoint}/generate-translation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetLanguage,
                baseTranslations,
                context: this.context,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'AI generation via server failed.');
        }
        return response.json();
    }

    async _saveToServer(filePath, data) {
        await fetch(`${this.apiEndpoint}/translations/${filePath}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data, null, 2),
        });
    }
}