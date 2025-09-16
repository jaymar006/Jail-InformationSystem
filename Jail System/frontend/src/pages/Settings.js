import React, { useState, useEffect } from 'react';
import Header from './Header';
import './Settings.css';

const Modal = ({ children, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
};

const Settings = () => {
  const [modalOpen, setModalOpen] = useState(null); // 'username' or 'password' or null
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const token = localStorage.getItem('token');
        console.log('Token:', token);
        if (!token) {
          setUsername('');
          setLoading(false);
          return;
        }
        const response = await fetch('/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        console.log('Response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('Username data:', data);
          setUsername(data.username);
        } else {
          console.log('Failed to fetch username');
          setUsername('');
        }
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername('');
      } finally {
        setLoading(false);
      }
    };

    fetchUsername();
  }, []);

  const openModal = (type) => {
    setModalOpen(type);
  };

  const closeModal = () => {
    setModalOpen(null);
    setNewUsername('');
    setNewPassword('');
  };

  const handleUsernameSubmit = (e) => {
    e.preventDefault();
    alert(`Username changed to: ${newUsername}`);
    closeModal();
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    alert('Password changed.');
    closeModal();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header />
      <div className="settings-container">
        <h2>Settings</h2>
        {username && (
          <div className="username-card">
            <strong>Username:</strong> {username}
          </div>
        )}
        <div className="settings-chooser">
          <button onClick={() => openModal('username')}>Change Username</button>
          <button onClick={() => openModal('password')}>Change Password</button>
        </div>

        {modalOpen === 'username' && (
          <Modal onClose={closeModal}>
            <h3>Change Username</h3>
            <form onSubmit={handleUsernameSubmit} className="settings-form">
              <label htmlFor="username">New Username:</label>
              <input
                type="text"
                id="username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
              <button type="submit">Change Username</button>
            </form>
          </Modal>
        )}

        {modalOpen === 'password' && (
          <Modal onClose={closeModal}>
            <h3>Change Password</h3>
            <form onSubmit={handlePasswordSubmit} className="settings-form">
              <label htmlFor="password">New Password:</label>
              <input
                type="password"
                id="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button type="submit">Change Password</button>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
};

export default Settings;
