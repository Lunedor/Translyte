![Translyte](translyte.png)
## Dynamic AI Web Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful and flexible solution for on-the-fly website translation. This project combines a client-side JavaScript library with a Node.js/Express backend to automatically translate web content using the Google Gemini API.

When a user requests a language for which a translation file doesn't exist, the system automatically generates it from a base language file, saves it on the server for future use, and updates the UI in real-time.


## Core Features

-   **On-Demand Translation**: No need to pre-translate all your content. Translations are generated only when they are first needed.
-   **Automatic File Generation**: The server automatically creates and saves new JSON translation files.
-   **Session Caching**: Translations are cached on the client-side to avoid re-fetching data during a single session.
-   **Flexible File Structure**: Easily configure any directory structure for your translation files (e.g., `en.json` or `en/main.json`).
-   **Any Base Language**: Your source language doesn't have to be English. Set up the project with German, French, Turkish or any other language as your source of truth.
-   **Preserves HTML**: The translation prompt is configured to preserve HTML tags and placeholder variables (like `{{name}}`) within your strings.

## How It Works

The magic of this system lies in its "generate-on-404" workflow:

1.  **Request**: The client-side library requests a translation file for a target language (e.g., Spanish - `es/main.json`).
2.  **Check Server**: The Node.js server looks for the requested file.
3.  **404 Not Found**: If the file doesn't exist, the server returns a `404 Not Found` error.
4.  **Handle 404**: The client-side library catches this specific error and recognizes it as a request for a new translation.
5.  **Fetch Base Language**: The library then requests the content of the *base* language file (e.g., English - `en/main.json`).
6.  **Generate Translation**: It sends the base language content, the target language code ('es'), and a context to the server's `/api/generate-translation` endpoint.
7.  **AI Proxy**: The server securely proxies this request to the Google Gemini API with your API key.
8.  **Save New File**: The server receives the generated JSON from the AI and saves it to the correct path (`translations/es/main.json`).
9.  **Return & Cache**: The newly generated translation is sent back to the client, which then updates the UI and caches the result for the session.

## Project Structure

```
/
├── translations/
│   └── en/
│       └── main.json      # Your base translation file
├── node_modules/
├── .env                   # For your secret API key (MUST be created)
├── translyte.js           # The core client-side library
├── index.html             # Demo page showing implementation
├── package.json
├── package-lock.json
└── server.js              # The Node.js backend
```

---

## 🚀 Setup and Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/Lunedor/Translyte
cd Translyte
```

### Step 2: Install Dependencies

Make sure you have [Node.js](https://nodejs.org/) installed. Then run:

```bash
npm install
```

### Step 3: Configure your API Key

The server needs your Google Gemini API key to work.

1.  Create a new file named `.env` in the root of the project.
2.  Add your API key to this file:

    ```
    # .env
    GEMINI_API_KEY=YOUR_API_KEY_HERE
    ```

    > **Security Note**: The `.env` file should be listed in your `.gitignore` file to prevent your secret key from being committed to source control.

### Step 4: Create Your Base Translation File

The system needs a "source of truth" to translate from.

1.  Create a folder structure inside `translations/`. For example: `translations/en/`.
2.  Create a JSON file inside it, for example `main.json`.
3.  Add your key-value pairs.

**Example: `translations/en/main.json`**

```json
{
  "header_title": "AI Translator Test Environment",
  "header_subtitle": "Using the flexible library with a simple folder structure.",
  "button_text": "Translate",
  "status_ready": "Ready to translate!",
  "json_response_title": "Raw JSON Response"
}
```

### Step 5: Run the Server

```bash
node server.js
```

You should see a confirmation message in your terminal:

```
===================================================
  Server started successfully at http://localhost:3000
===================================================
```

Now, you can open `http://localhost:3000` in your browser to see the demo page.

---

## 💡 Usage Guide

### 1. Tag your HTML

Add a `data-i18n-key` attribute to any HTML element you want to translate. The value of the attribute must match a key from your JSON file.

```html
<h1 data-i18n-key="header_title">This text will be replaced</h1>
<p data-i18n-key="header_subtitle">So will this.</p>
<button id="translateBtn" data-i18n-key="button_text">And this</button>
```

### 2. Initialize and Use the Library

In your page's JavaScript, instantiate the `Translyte` and create a function to apply the translations to your UI.

```html
<script src="./translyte.js"></script>
<script>
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize the translator with your configuration
    const translator = new Translyte({
        // The API endpoint on your server
        apiEndpoint: 'http://localhost:3000/api',
        // Defines the folder structure for translation files
        pathStructure: '{{lng}}/{{ns}}.json',
        // The language code of your source-of-truth files
        baseLanguage: 'en'
    });

    // 2. Helper function to update the UI
    function translateUI(translations) {
        document.querySelectorAll('[data-i18n-key]').forEach(element => {
            const key = element.getAttribute('data-i18n-key');
            if (translations[key]) {
                // Using .innerHTML allows rendering of HTML tags in your strings
                element.innerHTML = translations[key];
            }
        });
    }

    // 3. Event listener to trigger the translation
    document.getElementById('translateBtn').addEventListener('click', async () => {
        const targetLanguage = document.getElementById('languageSelect').value;
        try {
            // Fetch/generate the translation data for the 'main' namespace
            const translations = await translator.getTranslations(targetLanguage, 'main');

            // Apply the loaded translations to the page
            translateUI(translations);

        } catch (error) {
            console.error('Translation failed:', error);
        }
    });
});
</script>
```

## 🔧 Customization

### Changing the Base Language

To use a language other than English as your source, simply change the `baseLanguage` option during initialization and make sure your base files exist in the corresponding folder (e.g., `translations/tr/`).

```javascript
const translator = new Translyte({
    baseLanguage: 'tr', // Now uses Turkish as the source
    pathStructure: '{{lng}}/{{ns}}.json'
});
```

### Changing the Main Translations Directory

By default, translation files are stored in the `translations` folder. You can change this location by setting the `TRANSLATIONS_DIR` environment variable.

#### Usage

##### 1. Using a .env File

Create a `.env` file in your project root and add:

```
TRANSLATIONS_DIR=your_folder_name
```

##### 2. Setting the Variable in the Shell

**Windows PowerShell:**

```
$env:TRANSLATIONS_DIR = "your_folder_name"; node server.js
```

**Linux/macOS Bash:**

```
TRANSLATIONS_DIR=your_folder_name node server.js
```

Replace `your_folder_name` with the path to your desired translations directory.

If not set, the server will use the default `translations` folder.

### Changing the File Structure

The `pathStructure` option gives you full control. `{{lng}}` is replaced by the language code and `{{ns}}` by the namespace.

**Example 1: Simple, flat structure (e.g., `en.json`, `es.json`)**

```javascript
const translator = new Translyte({
    pathStructure: '{{lng}}.json'
});

// This call will look for 'es.json'
translator.getTranslations('es', 'main'); // 'main' is ignored here
```

**Example 2: Namespaced structure (e.g., `en/common.json`, `es/common.json`)**

```javascript
const translator = new Translyte({
    pathStructure: '{{lng}}/{{ns}}.json'
});

// This call will look for 'es/common.json'
translator.getTranslations('es', 'common');
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.