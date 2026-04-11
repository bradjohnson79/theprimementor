export declare const SYSTEM_SYNONYMS: {
    readonly vedic_astrology: readonly ["vedic", "vedic astrology", "jyotish", "jyotish astrology", "sidereal", "sidereal astrology", "indian astrology"];
    readonly western_astrology: readonly ["western astrology", "tropical astrology"];
    readonly chinese_astrology: readonly ["chinese astrology", "chinese zodiac"];
    readonly astrology_general: readonly ["astrology", "birth chart", "natal chart", "my chart"];
    readonly numerology: readonly ["numerology", "life path", "number reading"];
    readonly human_design: readonly ["human design", "projector", "generator", "manifestor", "reflector"];
    readonly kabbalah: readonly ["kabbalah", "kabbalistic"];
    readonly rune: readonly ["runes", "rune reading"];
};
export type ResolvedSystemKey = keyof typeof SYSTEM_SYNONYMS;
export declare function detectSystemsFromMessage(message: string): ResolvedSystemKey[];
export declare function resolveSystems(message: string): ResolvedSystemKey[];
//# sourceMappingURL=systemSynonyms.d.ts.map