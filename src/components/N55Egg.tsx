import { useEffect, useRef } from 'react';
import { Link } from './Link';
import PixelCat from './PixelCat';

/* What a search for N55 finds: a small window about pregabalin and what too
   much of it does. Plain, in Chinese, and closed with one tap. */

/** N55 and N552AA, in any case, with or without spaces. */
export const isN55Search = (q: string) => /^n55(2aa)?$/.test(q.toLowerCase().replace(/[\s\-_.]+/g, ''));

const HARMS = [
    '和阿片类、苯二氮䓬类或酒精一起用，会一起压住呼吸，这是普瑞巴林相关死亡里最常见的情况',
    '剂量一高，会头晕、站不稳、看东西重影、说话含糊，很容易摔倒受伤',
    '一次吞下很多，可能叫不醒，也可能抽搐',
    '天天用，耐受和依赖来得很快，突然停掉可能失眠、焦虑、出汗，严重时会抽搐，所以要慢慢减量',
    '肾不好的人排得慢，同样的量也更危险',
];

export function N55Egg({ onClose }: { onClose: () => void }) {
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        close.current?.focus();
        const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [onClose]);
    return (
        <div className="n55-scrim" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="n55-title"
                className="n55-card m-appear"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3">
                    <PixelCat pose="donut" size={40} />
                    <h2 id="n55-title" className="text-base font-semibold text-[var(--text)]">
                        {'普瑞巴林 OD 的危害'}
                    </h2>
                </div>
                <ul className="n55-list mt-3 text-sm leading-relaxed text-[var(--text)]">
                    {HARMS.map(h => (
                        <li key={h}>{h}</li>
                    ))}
                </ul>
                <p className="mt-3 text-sm leading-relaxed font-medium text-[var(--text)]">
                    {'如果身边有人叫不醒、呼吸很慢或者在抽搐，马上打 120，让 ta 侧躺，别留 ta 一个人'}
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <Link to={{ page: 'substance', id: 'pregabalin' }} className="btn-secondary btn-sm no-underline" onClick={onClose}>
                        {'看普瑞巴林'}
                    </Link>
                    <button ref={close} type="button" className="btn-primary btn-sm" onClick={onClose}>
                        {'知道了'}
                    </button>
                </div>
            </div>
        </div>
    );
}
