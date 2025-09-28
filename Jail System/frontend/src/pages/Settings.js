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
  const [modalOpen, setModalOpen] = useState(null); // 'username', 'password', 'cell', 'editCell', 'deleteAllPdls', 'deleteLogs', 'selectLogs' or null
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
  const [customCellName, setCustomCellName] = useState('');
  const [editingCell, setEditingCell] = useState(null);

  // Logs management state
  const [logs, setLogs] = useState([]);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

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
    setCustomCellName('');
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
    
    // Validate that if "Other" is selected, a custom name is provided
    if (cellForm.cell_name === 'Other' && !customCellName.trim()) {
      alert('Please enter a custom cell name when "Other" is selected.');
      return;
    }
    
    try {
      // Use custom cell name if "Other" is selected and custom name is provided
      const cellData = {
        ...cellForm,
        cell_name: cellForm.cell_name === 'Other' && customCellName.trim() 
          ? customCellName.trim() 
          : cellForm.cell_name
      };

      if (editingCell) {
        await axios.put(`/api/cells/${editingCell.id}`, cellData);
        alert('Cell updated successfully!');
      } else {
        await axios.post('/api/cells', cellData);
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
    
    // Check if the cell name is not one of the predefined options
    const predefinedNames = ['Quarantine', 'Cell', 'Other'];
    if (cell.cell_name && !predefinedNames.includes(cell.cell_name)) {
      setCellForm(prev => ({ ...prev, cell_name: 'Other' }));
      setCustomCellName(cell.cell_name);
    } else {
      setCustomCellName('');
    }
    
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

  // Delete all PDLs function
  const handleDeleteAllPdls = async () => {
    try {
      const response = await axios.delete('/pdls');
      if (response.data.message === 'All PDLs deleted successfully') {
        alert(`All PDLs deleted successfully. ${response.data.deletedCount} records removed.`);
      }
    } catch (err) {
      console.error('Failed to delete all PDLs:', err);
      alert(`Failed to delete all PDLs: ${err.response?.data?.error || err.message}`);
    }
    setModalOpen(null);
  };

  // Delete logs functions
  const handleDeleteAllLogs = async () => {
    try {
      const response = await axios.delete('/api/logs/all');
      if (response.data.message === 'All logs deleted successfully') {
        alert(`All logs deleted successfully. ${response.data.deletedCount} records removed.`);
      }
    } catch (err) {
      console.error('Failed to delete all logs:', err);
      alert(`Failed to delete all logs: ${err.response?.data?.error || err.message}`);
    }
    setModalOpen(null);
  };

  const handleDeleteLogsByDate = async (date) => {
    try {
      const response = await axios.delete('/api/logs/date', { data: { date } });
      if (response.data.message === 'Logs deleted successfully for the specified date') {
        alert(`Logs deleted successfully for ${date}. ${response.data.deletedCount} records removed.`);
      }
    } catch (err) {
      console.error('Failed to delete logs by date:', err);
      alert(`Failed to delete logs: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteLogsByDateRange = async (startDate, endDate) => {
    try {
      const response = await axios.delete('/api/logs/date-range', { 
        data: { startDate, endDate } 
      });
      if (response.data.message === 'Logs deleted successfully for the specified date range') {
        alert(`Logs deleted successfully from ${startDate} to ${endDate}. ${response.data.deletedCount} records removed.`);
      }
    } catch (err) {
      console.error('Failed to delete logs by date range:', err);
      alert(`Failed to delete logs: ${err.response?.data?.error || err.message}`);
    }
  };


  // Fetch all logs for selection
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await axios.get('/api/scanned_visitors');
      setLogs(response.data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      alert(`Failed to fetch logs: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Open logs selection modal
  const openLogsSelectionModal = async () => {
    await fetchLogs();
    setSelectedLogs([]);
    setModalOpen('selectLogs');
  };

  // Handle log selection
  const handleLogSelection = (logId, isSelected) => {
    if (isSelected) {
      setSelectedLogs([...selectedLogs, logId]);
    } else {
      setSelectedLogs(selectedLogs.filter(id => id !== logId));
    }
  };

  // Handle select all logs
  const handleSelectAllLogs = (isSelected) => {
    if (isSelected) {
      setSelectedLogs(logs.map(log => log.id));
    } else {
      setSelectedLogs([]);
    }
  };

  // Delete selected logs
  const handleDeleteSelectedLogs = async () => {
    if (selectedLogs.length === 0) {
      alert('Please select at least one log to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedLogs.length} selected log(s)?`)) {
      return;
    }

    try {
      let deletedCount = 0;
      let failedCount = 0;

      for (const logId of selectedLogs) {
        try {
          await axios.delete(`/api/scanned_visitors/${logId}`);
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete log ${logId}:`, err);
          failedCount++;
        }
      }

      if (deletedCount > 0) {
        alert(`Successfully deleted ${deletedCount} log(s).${failedCount > 0 ? ` ${failedCount} log(s) failed to delete.` : ''}`);
        await fetchLogs(); // Refresh the logs list
        setSelectedLogs([]);
      } else {
        alert('Failed to delete any logs.');
      }
    } catch (err) {
      console.error('Failed to delete selected logs:', err);
      alert(`Failed to delete logs: ${err.message}`);
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
          <button 
            onClick={() => openModal('deleteLogs')}
            style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white'
            }}
          >
            Delete Logs
          </button>
          <button 
            onClick={() => openModal('deleteAllPdls')}
            style={{
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              color: 'white'
            }}
          >
            Delete All PDLs
          </button>
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
                  setCustomCellName('');
                  setModalOpen('editCell');
                }}
              >
                + Add New Cell
              </button>
              <h3 style={{ margin: 0, flex: 1, textAlign: 'center' }}>Manage Cells</h3>
              <div style={{ width: '120px' }}></div>
            </div>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="cell-management-table">
                <thead>
                  <tr>
                    <th>Cell Name</th>
                    <th>Cell Number</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => (
                    <tr key={cell.id}>
                      <td>{cell.cell_name || '-'}</td>
                      <td>{cell.cell_number}</td>
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
              <select
                id="cell_name"
                value={cellForm.cell_name}
                onChange={(e) => {
                  setCellForm({ ...cellForm, cell_name: e.target.value });
                  // Clear custom name when switching away from "Other"
                  if (e.target.value !== 'Other') {
                    setCustomCellName('');
                  }
                }}
              >
                <option value="">Select Cell Type</option>
                <option value="Quarantine">Quarantine</option>
                <option value="Cell">Cell</option>
                <option value="Other">Other</option>
              </select>
              
              {cellForm.cell_name === 'Other' && (
                <>
                  <label htmlFor="custom_cell_name">Custom Cell Name:</label>
                  <input
                    type="text"
                    id="custom_cell_name"
                    value={customCellName}
                    onChange={(e) => setCustomCellName(e.target.value)}
                    placeholder="Enter custom cell name"
                    required
                  />
                </>
              )}
              
              <label htmlFor="capacity">Capacity:</label>
              <input
                type="number"
                id="capacity"
                value={cellForm.capacity}
                onChange={(e) => setCellForm({ ...cellForm, capacity: parseInt(e.target.value) || 1 })}
                min="1"
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

        {modalOpen === 'deleteAllPdls' && (
          <Modal onClose={closeModal}>
            <h3 style={{ color: '#dc2626', textAlign: 'center' }}>⚠️ Delete All PDLs</h3>
            
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ marginBottom: '15px', fontSize: '16px', color: '#374151' }}>
                Are you sure you want to delete <strong>ALL PDLs</strong>?
              </p>
              <p style={{ marginBottom: '15px', fontSize: '14px', color: '#6b7280' }}>
                This action will permanently remove all PDL records from the database.
              </p>
              <p style={{ fontSize: '14px', color: '#dc2626', fontWeight: '600' }}>
                This action cannot be undone!
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                onClick={handleDeleteAllPdls}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Yes, Delete All
              </button>
              <button
                onClick={closeModal}
                style={{
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancel
              </button>
            </div>
          </Modal>
        )}

        {modalOpen === 'deleteLogs' && (
          <Modal onClose={closeModal}>
            <h3 style={{ color: '#f59e0b', textAlign: 'center' }}>🗑️ Delete Logs</h3>
            
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ marginBottom: '15px', fontSize: '16px', color: '#374151' }}>
                Choose how you want to delete logs:
              </p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={handleDeleteAllLogs}
                style={{
                  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Delete All Logs
              </button>
              
              <div style={{ 
                padding: '16px', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Delete by Specific Date
                </h4>
                <input
                  type="date"
                  id="deleteDate"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}
                />
                <button
                  onClick={() => {
                    const date = document.getElementById('deleteDate').value;
                    if (date) {
                      handleDeleteLogsByDate(date);
                    } else {
                      alert('Please select a date');
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  }}
                >
                  Delete Logs for Selected Date
                </button>
              </div>
              
              <div style={{ 
                padding: '16px', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Delete by Date Range
                </h4>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="date"
                    id="startDate"
                    placeholder="Start Date"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="date"
                    id="endDate"
                    placeholder="End Date"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <button
                  onClick={() => {
                    const startDate = document.getElementById('startDate').value;
                    const endDate = document.getElementById('endDate').value;
                    if (startDate && endDate) {
                      if (new Date(startDate) <= new Date(endDate)) {
                        handleDeleteLogsByDateRange(startDate, endDate);
                      } else {
                        alert('Start date must be before or equal to end date');
                      }
                    } else {
                      alert('Please select both start and end dates');
                    }
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  }}
                >
                  Delete Logs for Date Range
                </button>
              </div>
              
              <div style={{ 
                padding: '16px', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px',
                backgroundColor: '#f9fafb'
              }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Select Specific Logs to Delete
                </h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#6b7280' }}>
                  Choose specific logs from a list to delete
                </p>
                <button
                  onClick={openLogsSelectionModal}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%'
                  }}
                >
                  Select Logs to Delete
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={closeModal}
                style={{
                  background: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Close
              </button>
            </div>
          </Modal>
        )}

        {modalOpen === 'selectLogs' && (
          <Modal onClose={closeModal}>
            <h3 style={{ color: '#ef4444', textAlign: 'center' }}>🗑️ Select Logs to Delete</h3>
            
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <p style={{ marginBottom: '15px', fontSize: '16px', color: '#374151' }}>
                Select the logs you want to delete:
              </p>
              <p style={{ marginBottom: '15px', fontSize: '14px', color: '#6b7280' }}>
                {selectedLogs.length} of {logs.length} logs selected
              </p>
            </div>

            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading logs...</div>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '16px', color: '#6b7280' }}>No logs found</div>
              </div>
            ) : (
              <>
                {/* Select All Checkbox */}
                <div style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={selectedLogs.length === logs.length && logs.length > 0}
                    onChange={(e) => handleSelectAllLogs(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                  <label htmlFor="selectAll" style={{ fontWeight: '600', color: '#374151', cursor: 'pointer' }}>
                    Select All ({logs.length} logs)
                  </label>
                </div>

                {/* Logs List */}
                <div style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backgroundColor: selectedLogs.includes(log.id) ? '#fef2f2' : 'white',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLogs.includes(log.id)}
                        onChange={(e) => handleLogSelection(log.id, e.target.checked)}
                        style={{ transform: 'scale(1.1)' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'flex-start',
                          marginBottom: '4px'
                        }}>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>
                            ID: {log.id} | {log.visitor_name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {new Date(log.scan_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '2px' }}>
                          PDL: {log.pdl_name} | Cell: {log.cell}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          Time In: {log.time_in ? new Date(log.time_in).toLocaleTimeString() : 'N/A'} | 
                          Time Out: {log.time_out ? new Date(log.time_out).toLocaleTimeString() : 'Open'}
                        </div>
                        {log.relationship && (
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            Relationship: {log.relationship}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '20px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '14px', color: '#374151' }}>
                    {selectedLogs.length} log(s) selected
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={closeModal}
                      style={{
                        background: '#e5e7eb',
                        color: '#374151',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteSelectedLogs}
                      disabled={selectedLogs.length === 0}
                      style={{
                        background: selectedLogs.length === 0 
                          ? '#d1d5db' 
                          : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: selectedLogs.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: selectedLogs.length === 0 ? 0.6 : 1
                      }}
                    >
                      Delete Selected ({selectedLogs.length})
                    </button>
                  </div>
                </div>
              </>
            )}
          </Modal>
        )}
      </div>
    </>
  );
};

export default Settings;
