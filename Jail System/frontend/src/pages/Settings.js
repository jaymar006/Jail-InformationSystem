import React, { useState, useEffect } from 'react';
import Header from './Header';
import axios from '../services/api';
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
  const [modalOpen, setModalOpen] = useState(null); // 'username', 'password', 'cell', 'editCell' or null
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Cell management state
  const [cells, setCells] = useState([]);
  const [cellForm, setCellForm] = useState({
    cell_number: '',
    cell_name: '',
    capacity: 1,
    status: 'active'
  });
  const [editingCell, setEditingCell] = useState(null);

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
        const response = await axios.get('/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        console.log('Response status:', response.status);
        console.log('Username data:', response.data);
        setUsername(response.data.username);
      } catch (error) {
        console.error('Error fetching username:', error);
        setUsername('');
      } finally {
        setLoading(false);
      }
    };

    const fetchCells = async () => {
      try {
        const response = await axios.get('/api/cells');
        setCells(response.data);
      } catch (error) {
        console.error('Error fetching cells:', error);
      }
    };

    fetchUsername();
    fetchCells();
  }, []);

  const openModal = (type) => {
    setModalOpen(type);
  };

  const closeModal = () => {
    setModalOpen(null);
    setNewUsername('');
    setCurrentPassword('');
    setNewPassword('');
    setCellForm({
      cell_number: '',
      cell_name: '',
      capacity: 1,
      status: 'active'
    });
    setEditingCell(null);
  };

  const handleUsernameSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You must be logged in to change your username');
        return;
      }

      const response = await axios.put('/auth/username', 
        { newUsername },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.message === 'Username updated successfully') {
        setUsername(newUsername);
        alert('Username updated successfully!');
        closeModal();
      }
    } catch (error) {
      console.error('Error updating username:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update username';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('You must be logged in to change your password');
        return;
      }

      if (!currentPassword || !newPassword) {
        alert('Please fill in both current and new password fields');
        return;
      }

      if (newPassword.length < 6) {
        alert('New password must be at least 6 characters long');
        return;
      }

      const response = await axios.put('/auth/password', 
        { currentPassword, newPassword },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.data.message === 'Password changed successfully') {
        alert('Password changed successfully!');
        closeModal();
      }
    } catch (error) {
      console.error('Error changing password:', error);
      const errorMessage = error.response?.data?.message || 'Failed to change password';
      alert(`Error: ${errorMessage}`);
    }
  };

  // Cell management functions
  const handleCellSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCell) {
        await axios.put(`/api/cells/${editingCell.id}`, cellForm);
        alert('Cell updated successfully!');
      } else {
        await axios.post('/api/cells', cellForm);
        alert('Cell added successfully!');
      }
      
      // Refresh cells list
      const response = await axios.get('/api/cells');
      setCells(response.data);
      closeModal();
    } catch (error) {
      console.error('Error saving cell:', error);
      alert('Error saving cell: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleEditCell = (cell) => {
    setEditingCell(cell);
    setCellForm({
      cell_number: cell.cell_number,
      cell_name: cell.cell_name || '',
      capacity: cell.capacity || 1,
      status: cell.status || 'active'
    });
    setModalOpen('editCell');
  };

  const handleDeleteCell = async (cellId) => {
    if (!window.confirm('Are you sure you want to delete this cell?')) return;
    
    try {
      await axios.delete(`/api/cells/${cellId}`);
      alert('Cell deleted successfully!');
      
      // Refresh cells list
      const response = await axios.get('/api/cells');
      setCells(response.data);
    } catch (error) {
      console.error('Error deleting cell:', error);
      alert('Error deleting cell: ' + (error.response?.data?.error || error.message));
    }
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
          <button onClick={() => openModal('cell')}>Manage Cells</button>
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
              <label htmlFor="currentPassword">Current Password:</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <label htmlFor="newPassword">New Password:</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="6"
              />
              <button type="submit">Change Password</button>
            </form>
          </Modal>
        )}

        {modalOpen === 'cell' && (
          <Modal onClose={closeModal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Manage Cells</h3>
              <button 
                className="add-cell-btn"
                onClick={() => {
                  setEditingCell(null);
                  setCellForm({
                    cell_number: '',
                    cell_name: '',
                    capacity: 1,
                    status: 'active'
                  });
                  setModalOpen('editCell');
                }}
              >
                + Add New Cell
              </button>
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="cell-management-table">
                <thead>
                  <tr>
                    <th>Cell Number</th>
                    <th>Cell Name</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => (
                    <tr key={cell.id}>
                      <td>{cell.cell_number}</td>
                      <td>{cell.cell_name || '-'}</td>
                      <td>{cell.capacity}</td>
                      <td>
                        <span className={`status-badge ${cell.status}`}>
                          {cell.status}
                        </span>
                      </td>
                      <td>
                        <div className="table-action-buttons">
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditCell(cell)}
                          >
                            Edit
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteCell(cell.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}

        {modalOpen === 'editCell' && (
          <Modal onClose={closeModal}>
            <h3>{editingCell ? 'Edit Cell' : 'Add New Cell'}</h3>
            <form onSubmit={handleCellSubmit} className="settings-form">
              <label htmlFor="cell_number">Cell Number *:</label>
              <input
                type="text"
                id="cell_number"
                value={cellForm.cell_number}
                onChange={(e) => setCellForm({ ...cellForm, cell_number: e.target.value })}
                required
                placeholder="e.g., C1, C2, etc."
              />
              
              <label htmlFor="cell_name">Cell Name:</label>
              <input
                type="text"
                id="cell_name"
                value={cellForm.cell_name}
                onChange={(e) => setCellForm({ ...cellForm, cell_name: e.target.value })}
                placeholder="Optional cell name"
              />
              
              <label htmlFor="capacity">Capacity:</label>
              <input
                type="number"
                id="capacity"
                value={cellForm.capacity}
                onChange={(e) => setCellForm({ ...cellForm, capacity: parseInt(e.target.value) || 1 })}
                min="1"
                max="100"
              />
              
              <label htmlFor="status">Status:</label>
              <select
                id="status"
                value={cellForm.status}
                onChange={(e) => setCellForm({ ...cellForm, status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button type="submit" style={{ flex: 1 }}>
                  {editingCell ? 'Update Cell' : 'Add Cell'}
                </button>
                <button 
                  type="button" 
                  onClick={closeModal} 
                  style={{ 
                    flex: 1, 
                    background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #4b5563 0%, #374151 100%)';
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 12px rgba(75, 85, 99, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </>
  );
};

export default Settings;
