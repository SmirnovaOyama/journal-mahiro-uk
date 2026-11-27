import { lockAfter, lockState, unlock, wipeDevice } from './kv';

/* The screen that asks for the code, before anything else of the site is
   loaded: with a lock on (lib/kv.ts) the journal can't be read until it's
   typed, so the app itself waits behind this. It is drawn by hand, with no
   React and none of the site's words fetched, and it names nothing: no
   title, no logo, nothing that says what it locks. */

type Words = { code: string; open: string; wrong: string; wait: string; erase: string; sure: string; yes: string; no: string };
const WORDS: Record<'en' | 'zh-Hant' | 'zh-Hans', Words> = {
    en: {
        code: 'Code',
        open: 'Open',
        wrong: 'That isn’t the code.',
        wait: 'Opening…',
        erase: 'Erase everything on this device',
        sure: 'Everything this site keeps on this device is erased, and can’t be brought back from here. A copy in an account stays.',
        yes: 'Erase',
        no: 'Keep it',
    },
    'zh-Hant': {
        code: '密碼',
        open: '開啟',
        wrong: '密碼不對。',
        wait: '開啟中…',
        erase: '清除這台裝置上的所有資料',
        sure: '這個網站存在這台裝置上的一切都會清除，無法從這裡復原。帳號裡的副本不受影響。',
        yes: '清除',
        no: '保留',
    },
    'zh-Hans': {
        code: '密码',
        open: '打开',
        wrong: '密码不对。',
        wait: '正在打开…',
        erase: '清除这台装置上的所有资料',
        sure: '这个网站存在这台装置上的一切都会清除，无法从这里复原。账号里的副本不受影响。',
        yes: '清除',
        no: '保留',
    },
};

function words(): Words {
    let lang: string | null = null;
    try {
        lang = JSON.parse(localStorage.getItem('journal.lang.v1') ?? 'null');
    } catch {
        /* the browser's, then */
    }
    if (lang !== 'en' && lang !== 'zh-Hant' && lang !== 'zh-Hans') {
        const first = (navigator.languages?.length ? navigator.languages : [navigator.language]).find(p => /^(zh|en)\b/i.test(p)) ?? 'en';
        lang = /^zh\b/i.test(first) ? (/\b(Hant|TW|HK|MO)\b/i.test(first) ? 'zh-Hant' : 'zh-Hans') : 'en';
    }
    return WORDS[lang as keyof typeof WORDS];
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag);
    e.className = className;
    if (text) e.textContent = text;
    return e;
}

/** Asks for the code in `host` until one opens the journal. */
export function askCode(host: HTMLElement): Promise<void> {
    const w = words();
    return new Promise(done => {
        const wrap = el('div', 'h-[100dvh] w-full flex flex-col items-center justify-center gap-4 px-8 bg-[var(--bg)] text-[var(--text)]');
        const form = el('form', 'w-full max-w-xs flex flex-col gap-4');
        const input = el('input', 'input-base w-full text-center text-lg tracking-widest');
        input.type = 'password';
        input.autocomplete = 'off';
        input.setAttribute('autocapitalize', 'off');
        input.setAttribute('aria-label', w.code);
        input.placeholder = w.code;
        const open = el('button', 'btn-primary w-full justify-center', w.open);
        open.type = 'submit';
        const note = el('p', 'min-h-5 text-center text-sm text-[var(--danger)]');
        note.setAttribute('role', 'status');
        form.append(input, open, note);

        const erase = el('button', 'link-button mt-8 text-xs !text-[var(--text-muted)]', w.erase);
        erase.type = 'button';
        const asking = el('div', 'hidden w-full max-w-xs flex-col gap-3 text-center text-sm');
        const sure = el('p', '', w.sure);
        const row = el('div', 'flex justify-center gap-2');
        const no = el('button', 'btn-secondary btn-sm', w.no);
        no.type = 'button';
        const yes = el('button', 'btn-danger btn-sm', w.yes);
        yes.type = 'button';
        row.append(no, yes);
        asking.append(sure, row);

        erase.onclick = () => {
            asking.classList.remove('hidden');
            asking.classList.add('flex');
            erase.classList.add('hidden');
        };
        no.onclick = () => {
            asking.classList.add('hidden');
            asking.classList.remove('flex');
            erase.classList.remove('hidden');
        };
        yes.onclick = () => {
            yes.disabled = true;
            void wipeDevice().then(() => window.location.replace('/'));
        };

        form.onsubmit = e => {
            e.preventDefault();
            const code = input.value;
            if (!code || open.disabled) return;
            open.disabled = true;
            note.textContent = '';
            open.textContent = w.wait;
            void unlock(code)
                .catch(() => false)
                .then(ok => {
                    if (ok) {
                        wrap.remove();
                        done();
                        return;
                    }
                    open.disabled = false;
                    open.textContent = w.open;
                    note.textContent = w.wrong;
                    input.value = '';
                    input.focus();
                });
        };

        wrap.append(form, erase, asking);
        host.replaceChildren(wrap);
        input.focus();
    });
}

/** With a lock that asks again after so long out of sight: once the page
 *  has been hidden that long, it starts over, at the code. */
export function lockWhenAway() {
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
        if (lockState() !== 'open') return;
        const after = lockAfter();
        if (document.visibilityState === 'hidden') hiddenAt = Date.now();
        else if (after > 0 && hiddenAt && Date.now() - hiddenAt > after * 60_000) window.location.reload();
    });
}
