import './index.css';
import './styles/app.css';
import { lockState } from './lib/kv';
import { askCode, lockWhenAway } from './lib/lockscreen';
import { applyQuiet, readQuiet } from './lib/quiet';

/* What runs first. With a lock on the journal (lib/kv.ts) nothing of the
   app is loaded until the code is typed: the app's own files read the
   journal as they load, and there's none to read before that. Without a
   lock this goes straight on. */

// A plain name and icon, if the reader chose one (index.html has already
// put them on; this keeps the title that way as pages change).
applyQuiet(readQuiet());

void (async () => {
    if (lockState() === 'locked') await askCode(document.getElementById('root')!);
    lockWhenAway();
    await import('./boot');
})();
