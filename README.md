# Crypto Trading System

This repository contains a simple HTML/JavaScript interface for a crypto trading system demo.

## Local setup

1. Clone the repository:
   ```bash
   git clone <REPO-URL>
   cd cryptoClaude
   ```
2. Start a basic HTTP server (Python 3 is preinstalled on most systems):
   ```bash
   python3 -m http.server 8080
   ```
   Then open your browser to `http://localhost:8080/index.html`.
   Alternatively you can open `index.html` directly in your browser, but using an HTTP server avoids CORS issues.

## File overview

- `index.html` – main page that loads `style.css` and `crypto-trading-complete.js`.
- `style.css` – styles for the application.
- `crypto-trading-complete.js` – JavaScript logic including wallet and trading functionality.

Ensure the file names match as above. The previous file `app.js` is replaced by `crypto-trading-complete.js` in the HTML.

