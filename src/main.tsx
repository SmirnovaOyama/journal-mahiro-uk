import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/app.css';
import { watchInputMode } from './utils/inputMode';
import { startSync } from './lib/account';
import { initLang } from './lib/lang';
import { askToKeep } from './lib/installed';
import { startOffline } from './lib/offline';
import { startWatchSharing } from './lib/watch';

watchInputMode();
// Signed in to an account: keep the journal in step with it.
startSync();
// Opened from the Home Screen: ask for the journal's storage to be kept.
askToKeep();
// Kept on the device, so it opens without a connection (public/sw.js).
startOffline();
// A night being shared with someone: keep their copy up to date.
startWatchSharing();

// The language is settled first, so the first page is drawn in it.
void initLang().finally(() =>
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    ),
);
