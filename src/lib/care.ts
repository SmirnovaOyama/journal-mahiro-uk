/* Some searches are not about getting high. Sodium nitrite, cyanide, paraquat,
   rat poison: nobody takes these for how they feel, and the people who look
   them up here are more often hurting than curious. For those, the search
   page says something kind before anything else, and keeps working as usual.

   Recreational nitrites (poppers: amyl, butyl, isobutyl nitrite) are left
   out on purpose: they are what this site is for. */

/** Lowercased, with spaces, dashes and punctuation gone, so "Sodium-Nitrite"
 *  and "sodium nitrite" read the same. */
const squash = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu, '');

/** Found anywhere in the search. */
const ANYWHERE = [
    // nitrites and nitrates, as salts (not alkyl nitrites)
    'sodiumnitrite', 'potassiumnitrite', 'sodiumnitrate', 'potassiumnitrate', 'nitritesalt', 'curingsalt', 'pinkcuringsalt', 'praguepowder',
    '亚硝酸钠', '亚硝酸钾', '亚硝酸盐', '硝酸钠', '工业盐', '亞硝酸鈉', '亞硝酸鉀', '亞硝酸鹽', '硝酸鈉',
    // cyanide
    'cyanide', 'hydrogencyanide', 'prussicacid', '氰化', '青化', '山奈', '山埃',
    // herbicides and pesticides
    'paraquat', 'gramoxone', 'diquat', 'organophosph', 'pesticide', 'insecticide', 'dichlorvos', 'chlorpyrifos', 'malathion', 'parathion',
    'methamidophos', 'dimethoate', 'carbofuran', 'aldicarb', 'glyphosate', 'roundup', 'weedkiller',
    '百草枯', '克无踪', '敌草快', '草甘膦', '农药', '農藥', '杀虫剂', '殺蟲劑', '除草剂', '除草劑', '敌敌畏', '敵敵畏', '甲胺磷', '乐果', '樂果',
    '毒死蜱', '对硫磷', '對硫磷', '呋喃丹', '涕灭威',
    // rodenticides
    'ratpoison', 'rodenticide', 'tetramethylenedisulfotetramine', 'bromadiolone', 'brodifacoum', 'phosphide', 'celphos', 'fluoroacetate', 'compound1080',
    '老鼠药', '老鼠藥', '鼠药', '鼠藥', '毒鼠强', '毒鼠強', '溴敌隆', '溴敵隆', '敌鼠', '敵鼠', '磷化铝', '磷化鋁', '磷化锌', '磷化鋅', '氟乙酸', '氟乙酰胺', '三步倒',
    // other classic poisons
    'strychnine', '士的宁', '士的寧', '马钱子', '馬錢子',
    'arsenic', 'arsenictrioxide', '砒霜', '三氧化二砷', '砷',
    'thallium', '铊', '鉈',
    'sodiumazide', '叠氮化钠', '疊氮化鈉',
    'ethyleneglycol', 'antifreeze', '乙二醇', '防冻液', '防凍液',
    'aconitine', '乌头碱', '烏頭鹼', '草乌', '草烏',
    'oleander', '夹竹桃', '夾竹桃',
    'colchicine', '秋水仙碱', '秋水仙鹼',
    'sodiumselenite', '亚硒酸钠', '亞硒酸鈉',
    'carbonmonoxide', 'charcoalburning', '一氧化碳', '烧炭', '燒炭',
    'hydrogensulfide', 'detergentsuicide', '硫化氢', '硫化氫',
    // the search says it outright
    'selfharm', 'hurtmyself', 'cutmyself', '自残', '自殘', '自伤', '自傷', '割腕',
    'suicide', 'killmyself', 'endmylife', 'wanttodie', 'howtodie', 'painlessdeath', 'lethaldose', 'fataldose', 'dosetodie',
    '自杀', '自殺', '想死', '轻生', '輕生', '不想活', '致死量', '致死剂量', '致死劑量', '怎么死', '怎麼死', '结束生命', '結束生命',
];

/** Short or ambiguous: only when it is the whole search. */
const WHOLE = new Set(['nitrite', 'nitrites', 'nitrate', 'nano2', 'kno2', 'nano3', 'kcn', 'nacn', 'hcn', '亚硝酸', '亞硝酸', '氰', 'as2o3', '1605', 'tetramine']);

/** Whether a search is for something people use to hurt themselves rather
 *  than to get high. */
export function isCareSearch(q: string): boolean {
    const t = squash(q);
    if (!t) return false;
    if (WHOLE.has(t)) return true;
    return ANYWHERE.some(w => t.includes(w));
}

/* And some searches are for help, now: "overdose", "急救", an ambulance's
   number. Those find the emergency page (pages/Emergency.tsx) above
   whatever else they find. */

/** Found anywhere in the search. */
const HELP_ANYWHERE = [
    'selfharm', 'hurtmyself', 'cutmyself', 'suicid', '自残', '自殘', '自伤', '自傷', '割腕', '自杀', '自殺', '轻生', '輕生',
    'overdose', 'emergency', 'ambulance', 'firstaid', 'recoveryposition', 'naloxone', 'narcan', 'notbreathing', 'wontwakeup', 'cantwake', 'seizure', 'serotoninsyndrome',
    '急救', '救护车', '救護車', '过量', '過量', '中毒', '救命', '叫不醒', '昏迷', '抽搐', '癫痫', '癲癇', '没有呼吸', '沒有呼吸', '呼吸困难', '呼吸困難', '纳洛酮', '納洛酮', '血清素综合征', '血清素症候群',
];

/** Short or ambiguous: only when it is the whole search. */
const HELP_WHOLE = new Set(['od', 'sos', 'help', 'cpr', '120', '119', '112', '911', '999', '995', '000', '111']);

/** Whether a search is someone looking for what to do in an emergency. */
export function isHelpSearch(q: string): boolean {
    const t = squash(q);
    if (!t) return false;
    if (HELP_WHOLE.has(t)) return true;
    return HELP_ANYWHERE.some(w => t.includes(w));
}

/** Whether to say it in Chinese first: the search has Chinese in it. */
export const saysChinese = (q: string) => /\p{Script=Han}/u.test(q);
