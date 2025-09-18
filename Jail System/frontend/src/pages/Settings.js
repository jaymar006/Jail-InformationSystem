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
    setNewPassword('');
    setCellForm({
      cell_number: '',
      cell_name: '',
      capacity: 1,
      status: 'active'
    });
    setEditingCell(null);
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

        {modalOpen === 'cell' && (
          <Modal onClose={closeModal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Manage Cells</h3>
              <button 
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
                style={{
                  background: '#4b5563',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add New Cell
              </button>
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Cell Number</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Cell Name</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Capacity</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'left' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => (
                    <tr key={cell.id}>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{cell.cell_number}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{cell.cell_name || '-'}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>{cell.capacity}</td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '12px',
                          backgroundColor: cell.status === 'active' ? '#d4edda' : '#f8d7da',
                          color: cell.status === 'active' ? '#155724' : '#721c24'
                        }}>
                          {cell.status}
                        </span>
                      </td>
                      <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                        <button 
                          onClick={() => handleEditCell(cell)}
                          style={{
                            background: '#007bff',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '4px'
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteCell(cell.id)}
                          style={{
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
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
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button type="submit" style={{ flex: 1 }}>
                  {editingCell ? 'Update Cell' : 'Add Cell'}
                </button>
                <button type="button" onClick={closeModal} style={{ flex: 1, background: '#6c757d' }}>
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
