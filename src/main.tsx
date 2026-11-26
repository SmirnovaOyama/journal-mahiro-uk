import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/app.css';
import { watchInputMode } from './utils/inputMode';
import { startSync } from './lib/account';
import { initLang } from './lib/lang';

watchInputMode();
// Signed in to an account: keep the journal in step with it.
startSync();

// The language is settled first, so the first page is drawn in it.
void initLang().finally(() =>
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    ),
);
