const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

const ROMAN_URDU = new Set([
  'mujhe','muje','mujy','mujhy','mujhay','mujko',
  'chahiye','chahye','chahiyay','chahiyey','chaiye','chayie','chahyay',
  'kya','kia','kyu','kyun','kiun','kun',
  'kaise','kese','kaisay','kesay','kese',
  'kahan','kahaan','kahin','kidhar',
  'kab','kabhi',
  'mein','main','mei',
  'mera','meri','mere','meray',
  'tera','teri','tere','teray',
  'iska','iski','iske','uska','uski','uske',
  'tum','tumhe','tumhara','tumhari','tujhe',
  'aap','aapko','aapka','aapki','apko','apka','apki',
  'hain','haan',
  'nahi','nahin','naheen',
  'theek','thik',
  'acha','achha','accha','aacha',
  'bohat','bohot','bahut','buhat','bht',
  'kuch','kuchh',
  'jaldi','abhi','phir','agar','lekin','magar','aur',
  'ghar','paani','paisa','paise','kaam',
  'subah','subha','shaam','sham','raat','aaj','kal','parso',
  'hafta','mahina',
  'bhejo','bhej','bhejna','bhejdo',
  'karna','karo','karein','kardo','karenge','krna','krdo','kardena','krden',
  'dena','dedo','dedena','dijiye','dijye',
  'lena','lijiye',
  'jana','jao','jaen','jaaye','jaaiye',
  'aana','aaen','aaye',
  'bhi','sirf','khali',
  'matlab','yani',
  'warna','warna',
  'wala','wali','walay','walon',
  'thora','thori','thoda','thodi','thori',
  'zyada','zyaada','ziada','ziyada',
  'bara','bari','barey','chota','choti','chote','chotay',
  'naya','nayi','naye','naya','nai',
  'der','jaldi',
  'hojaye','hogaya','hogya','hogyi','hojaega','hojaye','hojayega',
  'milega','milegi','milay','mile',
  'banao','banana','banaye','bana','banadena',
  'bata','batao','batadena','batayein',
  'samajh','samjhe','samjha','samjhi',
  'pakao','pakana','pakaya',
  'lagao','lagana','lagaya',
  'rakhdo','rakho','rakhna','rakhdena',
  'kholo','kholna','kholdo',
  'band','bandh','bandkardo',
]);

const STRONG_ROMAN_URDU = new Set([
  'mujhe','muje','mujy','mujhy','chahiye','chahye','chahiyay',
  'kyun','kyu','kaisay','kahaan',
  'bohot','bohat','bahut','jaldi','abhi','theek','achha',
  'nahin','naheen','nahi',
]);

const FUZZY_PATTERNS = [
  /^mujh?[eya]+$/,
  /^chah[iy]+[aey]y?$/,
  /^k[ry][a-z]{0,3}(do|na|den|dena|denge)?$/,
  /^h?[au]a?n+$/,
];

function normalize(token) {
  return token
    .toLowerCase()
    .replace(/(.)\1+/g, '$1');
}

export function detectLang(text, { minLength = 4 } = {}) {
  const raw = String(text || '').trim();
  if (raw.length < minLength) return null;
  if (URDU_SCRIPT.test(raw)) return 'Urdu';

  const tokens = raw.toLowerCase().match(/[a-z][a-z']*/g) || [];
  if (tokens.length === 0) return null;

  let hits = 0;
  let strongHits = 0;
  for (const t of tokens) {
    const n = normalize(t);
    const isHit =
      ROMAN_URDU.has(t) ||
      ROMAN_URDU.has(n) ||
      FUZZY_PATTERNS.some((re) => re.test(t) || re.test(n));
    if (isHit) {
      hits++;
      if (STRONG_ROMAN_URDU.has(t) || STRONG_ROMAN_URDU.has(n)) strongHits++;
    }
  }

  const ratio = hits / tokens.length;
  if (strongHits >= 1) return 'Roman Urdu';
  if (tokens.length <= 3 && hits >= 1) return 'Roman Urdu';
  if (ratio >= 0.25) return 'Roman Urdu';
  return 'English';
}
