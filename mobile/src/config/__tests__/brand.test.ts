import {
  BRAND,
  BRAND_COLORS,
  BRAND_MESSAGES,
  GOLDEN_HOUR,
  MIDNIGHT,
  GOLD,
  TYPOGRAPHY,
  SPACING,
  REFINED_WARMTH,
} from '../brand';

describe('Brand Config', () => {
  it('should export BRAND object with required fields', () => {
    expect(BRAND).toBeDefined();
    expect(BRAND.name).toBe('Chem IRL');
    expect(BRAND.domain).toBe('chemirl.app');
    expect(BRAND.url).toBe('https://chemirl.app');
    expect(BRAND.tagline).toBeDefined();
    expect(BRAND.description).toBeDefined();
  });

  it('should export BRAND_COLORS with required color values', () => {
    expect(BRAND_COLORS).toBeDefined();
    expect(BRAND_COLORS.primary).toBe('#0A7F74');
    expect(BRAND_COLORS.primaryLight).toBe('#34D399');
    expect(BRAND_COLORS.text).toBeDefined();
    expect(BRAND_COLORS.text[900]).toBe('#F5F5F5');
    expect(BRAND_COLORS.text[600]).toBe('#9CA3AF');
    expect(BRAND_COLORS.background).toBeDefined();
    expect(BRAND_COLORS.background[0]).toBe('#0D0F14');
  });

  it('should export BRAND_MESSAGES with proposal messages', () => {
    expect(BRAND_MESSAGES).toBeDefined();
    expect(BRAND_MESSAGES.proposal).toBeDefined();
    expect(BRAND_MESSAGES.proposal.error).toBeDefined();
    expect(BRAND_MESSAGES.proposal.expired).toBeDefined();
  });
});

describe('Midnight Chemistry Design System', () => {
  it('should export MIDNIGHT with dark color tokens', () => {
    expect(MIDNIGHT.bg).toBe('#0D0F14');
    expect(MIDNIGHT.surface).toBe('#111318');
    expect(MIDNIGHT.inputBg).toBe('#161922');
    expect(MIDNIGHT.borderDefault).toBe('#1a1f2e');
  });

  it('should export GOLDEN_HOUR as alias for MIDNIGHT', () => {
    expect(GOLDEN_HOUR).toBe(MIDNIGHT);
    expect(GOLDEN_HOUR.bg).toBe(MIDNIGHT.bg);
    expect(GOLDEN_HOUR.surface).toBe(MIDNIGHT.surface);
  });

  it('should export MIDNIGHT glass card style tokens', () => {
    expect(MIDNIGHT.glassCard.backgroundColor).toBe('rgba(17, 19, 24, 0.8)');
    expect(MIDNIGHT.glassCard.borderWidth).toBe(1);
    expect(MIDNIGHT.glassCard.borderColor).toBe('#1a1f2e');
    expect(MIDNIGHT.glassCard.borderRadius).toBe(20);
  });

  it('should export MIDNIGHT glow effects', () => {
    expect(MIDNIGHT.glow.primary).toBeDefined();
    expect(MIDNIGHT.glow.gold).toBeDefined();
    expect(MIDNIGHT.glow.selected).toBeDefined();
  });

  it('should export GOLD palette with full scale', () => {
    expect(GOLD[50]).toBe('#FFFBEB');
    expect(GOLD[600]).toBe('#CA8A04');
    expect(GOLD[900]).toBe('#713F12');
  });

  it('should export TYPOGRAPHY with Inter and Libre Caslon Text font families', () => {
    // Body fonts (Inter)
    expect(TYPOGRAPHY.fontFamily.regular).toBe('Inter-Regular');
    expect(TYPOGRAPHY.fontFamily.medium).toBe('Inter-Medium');
    expect(TYPOGRAPHY.fontFamily.semibold).toBe('Inter-SemiBold');
    expect(TYPOGRAPHY.fontFamily.bold).toBe('Inter-Bold');
    // Headline fonts (Libre Caslon Text)
    expect(TYPOGRAPHY.fontFamily.serif).toBe('LibreCaslonText-Regular');
    expect(TYPOGRAPHY.fontFamily.serifBold).toBe('LibreCaslonText-Bold');
    expect(TYPOGRAPHY.fontFamily.serifItalic).toBe('LibreCaslonText-Italic');
  });

  it('should export TYPOGRAPHY with font size scale', () => {
    expect(TYPOGRAPHY.fontSize.xs).toBe(12);
    expect(TYPOGRAPHY.fontSize.base).toBe(16);
    expect(TYPOGRAPHY.fontSize['4xl']).toBe(40);
  });

  it('should export SPACING scale', () => {
    expect(SPACING.xs).toBe(4);
    expect(SPACING.base).toBe(16);
    expect(SPACING['3xl']).toBe(48);
  });

  it('should export REFINED_WARMTH extending MIDNIGHT', () => {
    // Inherits Midnight values
    expect(REFINED_WARMTH.bg).toBe(MIDNIGHT.bg);
    expect(REFINED_WARMTH.surface).toBe(MIDNIGHT.surface);
    expect(REFINED_WARMTH.coral).toBe(MIDNIGHT.coral);

    // Gold accent
    expect(REFINED_WARMTH.gold).toBe('#CA8A04');
    expect(REFINED_WARMTH.goldSoft).toBe('#FEF3C7');
  });

  it('should export gradient presets as tuple pairs', () => {
    expect(REFINED_WARMTH.gradient.warmSurface).toHaveLength(2);
    expect(REFINED_WARMTH.gradient.premium).toHaveLength(2);
    expect(REFINED_WARMTH.gradient.celebration).toHaveLength(2);
    expect(REFINED_WARMTH.gradient.cardOverlay).toHaveLength(2);
    expect(REFINED_WARMTH.gradient.midnightGlow).toHaveLength(2);
  });

  it('should export extended radius with xl', () => {
    expect(REFINED_WARMTH.radius.lg).toBe(20);
    expect(REFINED_WARMTH.radius.xl).toBe(28);
  });

  it('should export animation constants', () => {
    expect(REFINED_WARMTH.animation.duration.fast).toBe(150);
    expect(REFINED_WARMTH.animation.duration.premium).toBe(600);
    expect(REFINED_WARMTH.animation.spring.default.damping).toBe(15);
  });
});
