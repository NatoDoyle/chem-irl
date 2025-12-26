import { BRAND, BRAND_COLORS, BRAND_MESSAGES } from '../brand';

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
    expect(BRAND_COLORS.primary).toBeDefined();
    expect(BRAND_COLORS.text).toBeDefined();
    expect(BRAND_COLORS.text[900]).toBeDefined();
    expect(BRAND_COLORS.text[600]).toBeDefined();
    expect(BRAND_COLORS.background).toBeDefined();
    expect(BRAND_COLORS.background[0]).toBeDefined();
  });

  it('should export BRAND_MESSAGES with proposal messages', () => {
    expect(BRAND_MESSAGES).toBeDefined();
    expect(BRAND_MESSAGES.proposal).toBeDefined();
    expect(BRAND_MESSAGES.proposal.error).toBeDefined();
    expect(BRAND_MESSAGES.proposal.expired).toBeDefined();
  });
});
