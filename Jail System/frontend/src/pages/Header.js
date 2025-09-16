// src/components/Header.js
import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Header.css';

const Header = ({ activePage }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useContext(AuthContext);
  const [username, setUsername] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        setUsername(payload.username || null);
      } catch (e) {
        setUsername(null);
      }
    } else {
      setUsername(null);
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    logout();
    localStorage.removeItem('token');
    navigate('/login');
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setDropdownOpen(false);
    }
  };

  useEffect(() => {
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <header className="dashboard-header">
      <div className="logos">
        <img src="/logo1.png" alt="Logo 1" />
        <img src="/logo2.png" alt="Logo 2" />
        
      </div>
      <div className="header-text">
        <h2>SILANG MUNICIPAL JAIL VISITATION MANAGEMENT SYSTEM</h2>
      </div>
      <nav className="nav-buttons">
        <Link to="/">
          <button className={location.pathname === '/' ? 'active' : ''}>Dashboard</button>
        </Link>
        <Link to="/datas">
          <button className={location.pathname === '/datas' ? 'active' : ''}>Datas</button>
        </Link>
        <Link to="/logs">
          <button className={location.pathname === '/logs' ? 'active' : ''}>Logs</button>
        </Link>
        {isAuthenticated && (
          <div className="dropdown" ref={dropdownRef}>
            <button className="dropdown-toggle" onClick={toggleDropdown}>
              {username} &#x25BC;
            </button>
            {dropdownOpen && (
              <div className="dropdown-menu">
                <Link to="/settings" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  Settings
                </Link>
                <button className="dropdown-item" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
