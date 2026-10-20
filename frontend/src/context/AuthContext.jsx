// File: frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../api/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('jwt_token') || '');
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    if (!token) {
      setCurrentUser(null);
      setLoadingAuth(false);
      return;
    }

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setCurrentUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('jwt_token');
        setToken('');
        setCurrentUser(null);
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, [token]);

  const loginSuccess = (newToken, userData) => {
    localStorage.setItem('jwt_token', newToken);
    setToken(newToken);
    setCurrentUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('jwt_token');
    setToken('');
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        currentUser,
        setCurrentUser,
        loadingAuth,
        loginSuccess,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);