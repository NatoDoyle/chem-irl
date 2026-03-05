import { createContext, useContext } from 'react';

const ProfileRefreshContext = createContext<() => void>(() => {});

export const useProfileRefresh = () => useContext(ProfileRefreshContext);

export default ProfileRefreshContext;
