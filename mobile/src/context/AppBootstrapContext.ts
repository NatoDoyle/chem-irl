import { createContext } from 'react';

export const AppBootstrapContext = createContext<{
  refreshSessionAndProfile: () => void;
  completeOnboarding: () => void;
}>({
  refreshSessionAndProfile: () => {},
  completeOnboarding: () => {},
});
