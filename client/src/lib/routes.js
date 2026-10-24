export const homeFor = (user) => (user?.role === 'owner' ? '/owner' : '/');
