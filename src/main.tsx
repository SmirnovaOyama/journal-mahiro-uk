import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/app.css';
import { watchInputMode } from './utils/inputMode';
import { startSync } from './lib/account';

watchInputMode();
// Signed in to an account: keep the journal in step with it.
startSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
