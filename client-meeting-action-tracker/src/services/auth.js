import { getUserProfile, saveUserProfile, DEFAULT_PROFILE } from '../utils/userProfile.js';

const AUTH_USER_KEY = 'cmtat_current_user';
const AUTH_TOKEN_KEY = 'cmtat_auth_token';
const USERS_LIST_KEY = 'cmtat_registered_users';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA !== 'false';

export function getAuthToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore
  }
}

const INITIAL_USERS = [
  {
    name: 'Jane Doe',
    email: 'jane.doe@company.com',
    password: 'password123',
    title: 'Senior Technical Account Manager',
    company: 'Apex Solutions Partners',
    role: 'Workspace Administrator',
    avatarBg: '#4f46e5',
  },
  {
    name: 'Alex Chen',
    email: 'alex.chen@innovate.io',
    password: 'password123',
    title: 'Lead Product Manager',
    company: 'Innovate Digital Systems',
    role: 'Project Reviewer',
    avatarBg: '#0ea5e9',
  },
];

function getStoredUsers() {
  try {
    const data = localStorage.getItem(USERS_LIST_KEY);
    if (!data) {
      localStorage.setItem(USERS_LIST_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_USERS;
  }
}

export function getCurrentUser() {
  try {
    const data = localStorage.getItem(AUTH_USER_KEY);
    if (data) return JSON.parse(data);
    // fallback to userProfile if exists
    return getUserProfile();
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function login({ email, password }) {
  if (!USE_MOCK) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: password || 'meeting-tracker-pass-2026',
          email: email?.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.access_token);
        const sessionUser = {
          name: data.user?.name || 'Workspace Member',
          email: data.user?.email || email,
          title: 'Workspace Reviewer',
          company: 'Client Workspace',
          role: data.user?.role || 'Admin',
          avatarBg: '#6366f1',
        };
        saveSession(sessionUser);
        return { success: true, user: sessionUser };
      }
    } catch {
      // Backend unreachable or offline, fall back to mock authentication
    }
  }

  await new Promise(resolve => setTimeout(resolve, 500)); // simulate network latency
  
  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();
  
  const matched = users.find(u => u.email.toLowerCase() === normalizedEmail);
  
  if (!matched) {
    // If not found in seed, but matches default or demo, allow it
    if (normalizedEmail === 'demo@company.com' || normalizedEmail === 'admin@company.com') {
      const demoUser = {
        name: 'Demo Evaluator',
        email: normalizedEmail,
        title: 'Solutions Architect',
        company: 'Cloud Enterprises',
        role: 'Workspace Administrator',
        avatarBg: '#6366f1',
      };
      setAuthToken('demo-token-mock-auth');
      saveSession(demoUser);
      return { success: true, user: demoUser };
    }
    throw new Error('No account found with this email. Try demo login or sign up.');
  }

  // If password provided doesn't match default mock password
  if (matched.password && matched.password !== password) {
    throw new Error('Incorrect password. For testing, use "password123" or Quick Demo Login.');
  }

  const sessionUser = {
    name: matched.name,
    email: matched.email,
    title: matched.title || 'Technical Account Manager',
    company: matched.company || 'Client Meeting Tracker SaaS',
    role: matched.role || 'Member',
    avatarBg: matched.avatarBg || '#6366f1',
  };

  setAuthToken('session-token-mock-auth');
  saveSession(sessionUser);
  return { success: true, user: sessionUser };
}

export async function signup({ name, email, company, password }) {
  await new Promise(resolve => setTimeout(resolve, 600));

  const users = getStoredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  const exists = users.some(u => u.email.toLowerCase() === normalizedEmail);
  if (exists) {
    throw new Error('An account with this email address already exists. Please sign in instead.');
  }

  const newUser = {
    name: name.trim(),
    email: normalizedEmail,
    password,
    company: company?.trim() || 'New Workspace',
    title: 'Workspace Owner',
    role: 'Administrator',
    avatarBg: '#6366f1',
  };

  const updatedUsers = [...users, newUser];
  try {
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(updatedUsers));
  } catch {
    // ignore
  }

  saveSession(newUser);
  return { success: true, user: newUser };
}

export async function quickDemoLogin() {
  await new Promise(resolve => setTimeout(resolve, 350));
  const demoUser = {
    name: 'Jane Doe',
    email: 'jane.doe@company.com',
    title: 'Senior Technical Account Manager',
    company: 'Apex Solutions Partners',
    role: 'Workspace Administrator',
    avatarBg: '#4f46e5',
  };
  setAuthToken('quick-demo-token');
  saveSession(demoUser);
  return { success: true, user: demoUser };
}

export function logout() {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
    setAuthToken(null);
    window.dispatchEvent(new Event('authChanged'));
  } catch {
    // ignore
  }
}

function saveSession(user) {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    saveUserProfile(user);
    window.dispatchEvent(new Event('authChanged'));
  } catch {
    // ignore
  }
}

