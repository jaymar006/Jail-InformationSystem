import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Datas from './pages/Datas';
import Logs from './pages/Logs';
import VisitorPage from './pages/VisitorPage';
import Login from './pages/Login';
import Settings from './pages/Settings';
import { VisitorProvider } from './context/VisitorContext';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

const App = () => {
  return (
    <AuthProvider>
      <VisitorProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/datas"
              element={
                <PrivateRoute>
                  <Datas />
                </PrivateRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <PrivateRoute>
                  <Logs />
                </PrivateRoute>
              }
            />
            <Route
              path="/visitors/:pdlId"
              element={
                <PrivateRoute>
                  <VisitorPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <Settings />
                </PrivateRoute>
              }
            />
          </Routes>
        </Router>
      </VisitorProvider>
    </AuthProvider>
  );
};

export default App;
