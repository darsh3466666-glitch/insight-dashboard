// Arabic name normalization: tashkeel, alef/yaa/taa variants, common honorific prefixes.
export function nameKey(input: string): string {
  if (!input) return "";
  let s = String(input).trim();
  // remove tashkeel (Arabic diacritics)
  s = s.replace(/[\u064B-\u0652\u0670]/g, "");
  // normalize alef, yaa, taa marbouta, hamza forms
  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه");
  // strip common honorific prefixes (multiple passes; support . / or trailing space)
  // "د.", "د/", "أ.", "م/", "ا/", "ست/", "الحاج", "الاستاذ", "المهندس", "السيد", "الدكتور"
  for (let i = 0; i < 3; i++) {
    const before = s;
    s = s.replace(
      /^(د\s*[.\/]|أ\s*[.\/]|ا\s*\/|م\s*\/|ست\s*\/|الحاج\s+|الاستاذ\s+|الأستاذ\s+|المهندس\s+|المهندسه\s+|السيد\s+|السيده\s+|الدكتور\s+|الدكتوره\s+|د\s+|أ\s+)\s*/,
      "",
    );
    if (s === before) break;
  }
  // normalize spacing around parens & dashes; collapse whitespace
  s = s.replace(/\s*\(\s*/g, " (").replace(/\s*\)\s*/g, ") ");
  s = s.replace(/\s+/g, " ").replace(/\s*-\s*/g, " - ").trim();
  return s.toLowerCase();
}

/** Strip parenthesized suffixes to get a "base" name key. Useful for fuzzy matching
 *  when the collection sheet omits or changes the family/location suffix. */
export function baseNameKey(input: string): string {
  const key = nameKey(input);
  return key.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}
