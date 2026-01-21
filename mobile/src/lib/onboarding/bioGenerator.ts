/**
 * Bio Generator - Generates a suggested bio from collected onboarding data
 */

export interface BioGeneratorInput {
  interests?: string[];
  lifestyle?: {
    activityLevel?: string;
    diet?: string;
  };
  intent?: string;
  idealDates?: string[];
  loveLanguage?: string;
  personalityType?: string;
  languages?: string[];
  pets?: string;
  familyPlans?: string;
}

/**
 * Generate a suggested bio from onboarding data
 */
export function generateBio(input: BioGeneratorInput): string {
  const parts: string[] = [];

  // Opening based on intent
  if (input.intent) {
    const intentMap: Record<string, string> = {
      serious: "I'm looking for a meaningful connection",
      casual: "I'm open to seeing where things go",
      friendship: "I'm looking to meet new people and build friendships",
      not_sure: "I'm exploring what's out there",
    };
    parts.push(intentMap[input.intent] || "I'm looking to connect");
  } else {
    parts.push("I'm looking to connect");
  }

  // Interests
  if (input.interests && input.interests.length > 0) {
    const interestsList = input.interests.slice(0, 5).join(', ');
    parts.push(`I love ${interestsList}`);
  }

  // Lifestyle
  if (input.lifestyle?.activityLevel) {
    const activityMap: Record<string, string> = {
      very_active: "I'm very active and love outdoor adventures",
      active: 'I stay active and enjoy being outdoors',
      moderate: 'I enjoy a balanced lifestyle',
      low: 'I prefer a more relaxed pace',
    };
    parts.push(activityMap[input.lifestyle.activityLevel] || '');
  }

  // Ideal dates
  if (input.idealDates && input.idealDates.length > 0) {
    const datesList = input.idealDates.slice(0, 2).join(' or ');
    parts.push(`My ideal first date would be ${datesList}`);
  }

  // Love language
  if (input.loveLanguage) {
    const loveLanguageMap: Record<string, string> = {
      words_of_affirmation: 'I value open communication and words of affirmation',
      acts_of_service: 'I show love through actions and helping others',
      receiving_gifts: 'I appreciate thoughtful gestures',
      quality_time: 'I value quality time and deep conversations',
      physical_touch: "I'm affectionate and value physical connection",
    };
    parts.push(loveLanguageMap[input.loveLanguage] || '');
  }

  // Personality
  if (input.personalityType) {
    parts.push(`I'm a ${input.personalityType}`);
  }

  // Languages
  if (input.languages && input.languages.length > 0) {
    const langList = input.languages.join(', ');
    parts.push(`I speak ${langList}`);
  }

  // Pets
  if (input.pets) {
    const petsMap: Record<string, string> = {
      have_dogs: 'I have dogs and love them',
      have_cats: "I have cats and they're my world",
      have_other: "I have pets and they're important to me",
      want_pets: "I'd love to have pets someday",
      no_pets: "I'm not a pet person",
      allergic: "I'm allergic to pets",
    };
    parts.push(petsMap[input.pets] || '');
  }

  // Family plans
  if (input.familyPlans) {
    const familyMap: Record<string, string> = {
      want_children: "I'd like to have children someday",
      have_children: "I have children and they're my priority",
      dont_want_children: "I don't want children",
      not_sure: "I'm not sure about children yet",
    };
    parts.push(familyMap[input.familyPlans] || '');
  }

  // Join parts and clean up
  let bio = parts.filter((p) => p.length > 0).join('. ') + '.';

  // Ensure minimum length
  if (bio.length < 50) {
    bio += " I'm excited to meet new people and see where this journey takes me.";
  }

  // Cap at reasonable length (will be validated in UI)
  if (bio.length > 500) {
    bio = bio.substring(0, 497) + '...';
  }

  return bio;
}
