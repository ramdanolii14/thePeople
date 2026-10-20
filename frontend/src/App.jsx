import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import IndexPage from './pages/IndexPage';
import FeedPage from './pages/FeedPage';
import AddPostPage from './pages/AddPostPage';
import EditPostPage from './pages/EditPostPage';
import DashboardPage from './pages/DashboardPage';
import UserProfilePage from './pages/UserProfilePage';
import AuthPage from './pages/AuthPage';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-[#F0F2F5] text-gray-800 flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
              <Routes>
                <Route path="/" element={<IndexPage />} />
                <Route path="/feed" element={<FeedPage />} />
                <Route path="/add-post" element={<AddPostPage />} />
                <Route path="/edit-post/:id" element={<EditPostPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/user" element={<UserProfilePage />} />
                <Route path="/user/:id" element={<UserProfilePage />} />
                <Route path="/auth" element={<AuthPage />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
