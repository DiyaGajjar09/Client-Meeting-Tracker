export const DEFAULT_PROFILE = {
  name: 'Jane Doe',
  email: 'jane.doe@company.com',
  title: 'Senior Technical Account Manager',
  company: 'Apex Solutions Partners',
  timezone: 'Europe/London (GMT+1)',
  role: 'Workspace Administrator',
  avatarBg: '#4f46e5',
};

const PROFILE_KEY = 'cmtat_user_profile';

export function getUserProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveUserProfile(profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event('profileUpdated'));
  } catch {
    // ignore
  }
}

