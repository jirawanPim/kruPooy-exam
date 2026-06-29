import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { PopupProvider } from './components/PopupProvider';

import Home from './pages/Home';
import TeacherDashboard from './pages/TeacherDashboard';
import ExamPage from './pages/ExamPage';
import Lobby from './pages/Lobby';
import Login from './pages/Login';
import ExamManager from './pages/ExamManager';
import ExamEditor from './pages/ExamEditor'; 
import ClassManager from './pages/ClassManager';
import LiveMonitor from './pages/LiveMonitor';
import RoomResult from './pages/RoomResult';
import GradingQueue from './pages/GradingQueue';

const PrivateRoute = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsubscribe();
  }, []);
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-orange-500 text-white font-black italic">LOADING...</div>;
  return user ? children : <Navigate to="/login" />;
};

const App = () => {
  return (
    <PopupProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/exam-page" element={<ExamPage />} />
          <Route path="/login" element={<Login />} />
          
          <Route path="/dashboard" element={<PrivateRoute><TeacherDashboard /></PrivateRoute>} />
          <Route path="/class-manager" element={<PrivateRoute><ClassManager /></PrivateRoute>} />
          <Route path="/exam-manager" element={<PrivateRoute><ExamManager /></PrivateRoute>} />
          <Route path="/exam-editor" element={<PrivateRoute><ExamEditor /></PrivateRoute>} />
          <Route path="/exam-editor/:examId" element={<PrivateRoute><ExamEditor /></PrivateRoute>} />
          <Route path="/live-monitor/:roomId" element={<PrivateRoute><LiveMonitor /></PrivateRoute>} />
          <Route path="/room-result" element={<PrivateRoute><RoomResult /></PrivateRoute>} />
          <Route path="/room-result/:roomId" element={<PrivateRoute><RoomResult /></PrivateRoute>} />
          <Route path="/grading-queue/:roomId" element={<PrivateRoute><GradingQueue /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </PopupProvider>
  );
};

export default App;