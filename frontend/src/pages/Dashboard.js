import React, { useState, useEffect, useCallback } from 'react';
import Header from './Header';
import QRCodeScanner from '../components/QRCodeScanner';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [visitors, setVisitors] = useState([]);
  const [resetTrigger] = useState(0);

  const [selectedVisitorId, setSelectedVisitorId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');
  const [showPurposeModal, setShowPurposeModal] = useState(false);
  const [pendingScanData, setPendingScanData] = useState(null);
  const [scanLocked, setScanLocked] = useState(false);
  const [lastScanSig, setLastScanSig] = useState(null);
  const [lastScanAt, setLastScanAt] = useState(0);
  const [selectedDeleteIds, setSelectedDeleteIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [availableCells, setAvailableCells] = useState([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledCells, setScheduledCells] = useState(new Set());

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };


  const toInputTimeHHMMSS = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const capitalizeWords = (str) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getDateString = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toISOString().split('T')[0];
  };

  const currentDateString = getDateString(new Date().toISOString());

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 3000);
  }, []);

  const fetchVisitors = useCallback(async () => {
    try {
      const res = await api.get('/api/scanned_visitors');
      setVisitors(res.data);
    } catch (error) {
      console.error('Failed to fetch visitors:', error);
      showToast('Failed to fetch visitors data', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    fetchVisitors();
    fetchAvailableCells();
  }, [fetchVisitors]);

  const fetchAvailableCells = async () => {
    try {
      const response = await api.get('/api/cells/active');
      setAvailableCells(response.data);
    } catch (error) {
      console.error('Failed to fetch cells:', error);
    }
  };

  const handleCellScheduleToggle = (cellNumber) => {
    setScheduledCells(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cellNumber)) {
        newSet.delete(cellNumber);
      } else {
        newSet.add(cellNumber);
      }
      return newSet;
    });
  };

  const isCellScheduled = (cellNumber) => {
    return scheduledCells.has(cellNumber);
  };

  const handleScan = async (data) => {
    if (!data) return;
    if (scanLocked) return;

    const regex = /\[(.*?)\]/g;
    const matches = [...data.matchAll(regex)].map(match => match[1]);

    let visitorName = '', pdlName = '', cell = '', relationship = '', contactNumber = '';

    matches.forEach(part => {
      if (part.startsWith('Visitor:')) visitorName = part.replace('Visitor:', '').trim();
      else if (part.startsWith('PDL:')) pdlName = part.replace('PDL:', '').trim();
      else if (part.startsWith('Cell:')) cell = part.replace('Cell:', '').trim();
      else if (part.startsWith('Relationship:')) relationship = part.replace('Relationship:', '').trim();
      else if (part.startsWith('Contact:')) contactNumber = part.replace('Contact:', '').trim();
    });

    if (!visitorName || !pdlName || !cell) {
      showToast('Invalid QR code format', 'error');
      return;
    }

    // Check if the cell is scheduled for visits
    if (!isCellScheduled(cell)) {
      showToast(`Cell ${cell} is not scheduled for visits today. Please contact the administrator.`, 'error');
      return;
    }

    // Debounce same QR contents for a short window
    const sig = `${visitorName}|${pdlName}|${cell}`;
    const nowMs = Date.now();
    if (lastScanSig === sig && nowMs - lastScanAt < 5000) {
      return; // ignore duplicate immediately after previous scan
    }
    setLastScanSig(sig);
    setLastScanAt(nowMs);

    // Lock scanning to prevent double fires from the same QR frame
    setScanLocked(true);

    // Preflight: ask backend if this is a time_in or time_out
    try {
      const preflight = await api.post('/api/scanned_visitors', {
        visitor_name: visitorName,
        pdl_name: pdlName,
        cell,
        relationship,
        contact_number: contactNumber,
        only_check: true
      });

      const planned = preflight?.data?.action;
      if (planned === 'time_out') {
        // Directly execute time_out without purpose modal
        const scanData = {
          visitor_name: visitorName,
          pdl_name: pdlName,
          cell,
          relationship,
          contact_number: contactNumber
        };
        await api.post('/api/scanned_visitors', {
          ...scanData,
          device_time: new Date().toISOString()
        });
        showToast('Successful time out!', 'success');
        await fetchVisitors();
        setTimeout(() => setScanLocked(false), 1200);
        return;
      }

      // Otherwise show modal for purpose selection (time in)
      setPendingScanData({
        visitor_name: visitorName,
        pdl_name: pdlName,
        cell,
        relationship,
        contact_number: contactNumber
      });
      setShowPurposeModal(true);
    } catch (e) {
      console.error('Preflight scan error:', e);
      showToast('Scan preflight failed', 'error');
      setTimeout(() => setScanLocked(false), 800);
    }
  };

  const handlePurposeSelection = async (purpose) => {
    if (!pendingScanData) return;

    setShowPurposeModal(false);

    try {
      const response = await api.post('/api/scanned_visitors', {
        ...pendingScanData,
        device_time: new Date().toISOString(),
        purpose
      });

      const action = response?.data?.action;
      if (action === 'time_out') {
        showToast('Successful time out!', 'success');
      } else if (action === 'time_in') {
        showToast('Successful time in!', 'success');
      } else if (action === 'already_timed_out') {
        showToast('This visitor has already timed out.', 'error');
      } else {
        showToast('Scan recorded!', 'success');
      }

      fetchVisitors();
    } catch (error) {
      console.error('Error adding scanned visitor:', error);
      showToast('Error adding scanned visitor', 'error');
    }

    setPendingScanData(null);
    // Unlock scanning after a short cooldown to avoid immediate re-trigger
    setTimeout(() => setScanLocked(false), 2000);
  };

  const handleRowClick = (id) => {
    setSelectedVisitorId(id === selectedVisitorId ? null : id);
  };

  const openEditModalForRow = (visitor) => {
    if (!visitor) return;
    setSelectedVisitorId(visitor.id);
    setEditTimeIn(visitor.time_in ? toInputTimeHHMMSS(visitor.time_in) : '');
    setEditTimeOut(visitor.time_out ? toInputTimeHHMMSS(visitor.time_out) : '');
    setShowEditModal(true);
  };


  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedVisitorId) return;

    const dateStr = currentDateString;
    const timeInISO = new Date(`${dateStr}T${editTimeIn}`).toISOString();
    const timeOutISO = new Date(`${dateStr}T${editTimeOut}`).toISOString();

    try {
      await api.put(`/api/scanned_visitors/${selectedVisitorId}`, {
        time_in: timeInISO,
        time_out: timeOutISO
      });

      alert('Visitor times updated successfully.');
      setShowEditModal(false);
      fetchVisitors();
      window.dispatchEvent(new Event('visitorTimesUpdated'));
    } catch (error) {
      console.error('Failed to update visitor times:', error);
      alert('Failed to update visitor times.');
    }
  };

  const filteredVisitors = visitors.filter(
    v => getDateString(v.time_in) === currentDateString
  );

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedDeleteIds([]);
      setSelectAll(false);
    } else {
      const allIds = filteredVisitors.map(v => v.id);
      setSelectedDeleteIds(allIds);
      setSelectAll(true);
    }
  };

  const handleToggleRowDelete = (id) => {
    setSelectedDeleteIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        if (selectAll && next.length !== filteredVisitors.length) setSelectAll(false);
        return next;
      } else {
        const next = [...prev, id];
        if (next.length === filteredVisitors.length) setSelectAll(true);
        return next;
      }
    });
  };

  const handleDelete = async () => {
    if (selectedDeleteIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedDeleteIds.length} record(s)?`)) return;
    try {
      await Promise.all(selectedDeleteIds.map(id => api.delete(`/api/scanned_visitors/${id}`)));
      setSelectedDeleteIds([]);
      setSelectAll(false);
      setSelectedVisitorId(null);
      await fetchVisitors();
    } catch (error) {
      console.error('Failed to delete visitors:', error);
      alert('Failed to delete some visitors.');
    }
  };

  return (
    <div>
      <Header activePage="Dashboard" />
      
      {/* Toast Notification */}
      {toast.show && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: toast.type === 'success' 
              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' 
              : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: '500',
            animation: 'slideDown 0.3s ease-out',
            maxWidth: '400px',
            textAlign: 'center'
          }}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            {toast.type === 'success' ? (
              <>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <path d="M22 4 12 14.01l-3-3"/>
              </>
            ) : (
              <>
                <path d="M18 6 6 18"/>
                <path d="M6 6l12 12"/>
              </>
            )}
          </svg>
          {toast.message}
        </div>
      )}
      
      <main className="dashboard-main">
        <section style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 16px 0' }}>QR Code Scanner</h2>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <button 
              className="common-button" 
              onClick={() => setShowScheduleModal(true)}
              style={{
                background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Schedule
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <QRCodeScanner onScan={handleScan} onError={() => showToast('QR Scan error', 'error')} resetTrigger={resetTrigger} />
          </div>
        </section>

        <section>
          <div id="printable-dashboard" className="print-section">
            <div className="print-only" style={{ textAlign: 'center', marginBottom: '10px' }}>
              <img src="/logo1.png" alt="Logo 1" style={{ height: '60px', marginRight: '10px' }} />
              <img src="/logo2.png" alt="Logo 2" style={{ height: '60px', marginRight: '10px' }} />
              <img src="/logo3.png" alt="Logo 3" style={{ height: '60px' }} />
              <h1 style={{ marginTop: '10px' }}>SILANG MUNICIPAL JAIL VISITATION MANAGEMENT SYSTEM</h1>
            </div>

            <b style={{ display: 'block', textAlign: 'center', marginBottom: '10px' }}>
              {new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </b>
            <h2 style={{ textAlign: 'center' }}>Allowed Visitors</h2>


            <table className="common-table">
              <thead>
                <tr>
                  <th className="no-print">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Visitor's Name</th>
                  <th>PDL's to be Visited</th>
                  <th>Cell</th>
                  <th>Purpose</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th className="no-print" style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.length === 0 ? (
                  <tr><td colSpan="7">No records</td></tr>
                ) : (
                  filteredVisitors.map(v => (
                    <tr
                      key={v.id}
                      onClick={() => handleRowClick(v.id)}
                      style={{
                        backgroundColor: v.id === selectedVisitorId ? '#d3d3d3' : 'transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <td className="no-print">
                        <input
                          type="checkbox"
                          checked={selectedDeleteIds.includes(v.id)}
                          onChange={(e) => { e.stopPropagation(); handleToggleRowDelete(v.id); }}
                        />
                      </td>
                      <td>{capitalizeWords(v.visitor_name)}</td>
                      <td>{capitalizeWords(v.pdl_name)}</td>
                      <td>
                        {(() => {
                          const cell = availableCells.find(c => c.cell_number.toLowerCase() === v.cell.toLowerCase());
                          return cell && cell.cell_name ? `${cell.cell_name} - ${capitalizeWords(v.cell)}` : capitalizeWords(v.cell);
                        })()}
                      </td>
                      <td>{v.purpose ? (v.purpose.charAt(0).toUpperCase() + v.purpose.slice(1)) : ''}</td>
                      <td>{formatTime(v.time_in)}</td>
                      <td>{v.time_out ? formatTime(v.time_out) : ''}</td>
                      <td className="no-print" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            className="common-button edit no-print"
                            onClick={(e) => { e.stopPropagation(); openEditModalForRow(v); }}
                          >
                            <svg className="button-icon" viewBox="0 0 24 24">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="common-button" onClick={() => window.print()}>
              <svg className="button-icon" viewBox="0 0 24 24">
                <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/>
              </svg>
              Print Table
            </button>
            {selectedDeleteIds.length > 0 && (
              <button className="common-button delete" onClick={handleDelete}>
                <svg className="button-icon" viewBox="0 0 24 24">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Delete Selected ({selectedDeleteIds.length})
              </button>
            )}
          </div>
        </section>

        {/* Purpose Selection Modal */}
        {showPurposeModal && (
          <div className="common-modal">
            <div className="common-modal-content purpose-modal">
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '600' }}>Select Visit Purpose</h3>
                  <div style={{ fontSize: '14px', opacity: '0.9' }}>
                    <p style={{ margin: '4px 0' }}><strong>Visitor:</strong> {capitalizeWords(pendingScanData?.visitor_name)}</p>
                    <p style={{ margin: '4px 0' }}><strong>PDL:</strong> {capitalizeWords(pendingScanData?.pdl_name)}</p>
                    <p style={{ margin: '4px 0' }}><strong>Cell:</strong> {capitalizeWords(pendingScanData?.cell)}</p>
                  </div>
                </div>
              </div>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '20px'
              }}>
                <button 
                  className="purpose-button conjugal" 
                  onClick={() => handlePurposeSelection('conjugal')}
                  style={{ 
                    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
                  }}
                >
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.1)', 
                    borderRadius: '50%', 
                    width: '60px', 
                    height: '60px', 
                    margin: '0 auto 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                      <path d="M12 14l3-3 3 3"/>
                    </svg>
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>Conjugal Visit</h4>
                  <p style={{ margin: '0', fontSize: '12px', opacity: '0.9' }}>Private family visit</p>
                </button>
                
                <button 
                  className="purpose-button normal" 
                  onClick={() => handlePurposeSelection('normal')}
                  style={{ 
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(5, 150, 105, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
                  }}
                >
                  <div style={{ 
                    background: 'rgba(255, 255, 255, 0.1)', 
                    borderRadius: '50%', 
                    width: '60px', 
                    height: '60px', 
                    margin: '0 auto 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>Normal Visit</h4>
                  <p style={{ margin: '0', fontSize: '12px', opacity: '0.9' }}>Regular visitation</p>
                </button>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowPurposeModal(false);
                    setPendingScanData(null);
                    setTimeout(() => setScanLocked(false), 500);
                  }}
                  style={{
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="common-modal">
            <div className="common-modal-content">
              <h3>Edit Visitor Times</h3>
              <form onSubmit={handleEditSubmit}>
                <label>
                  Time In (HH:MM:SS):
                  <input type="time" step="1" value={editTimeIn} onChange={(e) => setEditTimeIn(e.target.value)} required />
                </label>
                <br />
                <label>
                  Time Out (HH:MM:SS):
                  <input type="time" step="1" value={editTimeOut} onChange={(e) => setEditTimeOut(e.target.value)} required />
                </label>
                <br />
                <div className="common-modal-buttons">
                  <button type="submit" className="common-button save">
                    <svg className="button-icon" viewBox="0 0 24 24">
                      <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
                    </svg>
                    Save
                  </button>
                  <button type="button" className="common-button cancel" onClick={() => setShowEditModal(false)}>
                    <svg className="button-icon" viewBox="0 0 24 24">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="common-modal">
            <div className="common-modal-content" style={{ maxWidth: '500px' }}>
              <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '24px', fontWeight: '600', color: '#111827' }}>
                Schedule Cell Visits
              </h3>
              
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                  Select which cells are available for visits today. Only visitors to scheduled cells will be allowed to scan in.
                </p>
                
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '16px', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {availableCells.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#6b7280', fontStyle: 'italic' }}>
                      No active cells found. Please add cells in Settings first.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px' }}>
                      {availableCells.map((cell) => (
                        <label 
                          key={cell.id}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            padding: '12px',
                            background: isCellScheduled(cell.cell_number) ? '#ecfdf5' : '#fff',
                            border: isCellScheduled(cell.cell_number) ? '2px solid #10b981' : '2px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isCellScheduled(cell.cell_number)}
                            onChange={() => handleCellScheduleToggle(cell.cell_number)}
                            style={{
                              width: '18px',
                              height: '18px',
                              cursor: 'pointer'
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: '#111827' }}>
                              {cell.cell_name ? `${cell.cell_name} - ${cell.cell_number}` : cell.cell_number}
                            </div>
                            {cell.cell_name && (
                              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                                Cell Number: {cell.cell_number}
                              </div>
                            )}
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Capacity: {cell.capacity} | Status: {cell.status}
                            </div>
                          </div>
                          {isCellScheduled(cell.cell_number) && (
                            <div style={{ 
                              background: '#10b981', 
                              color: 'white', 
                              padding: '4px 8px', 
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              Scheduled
                            </div>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px 0',
                borderTop: '1px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>
                  {scheduledCells.size} of {availableCells.length} cells scheduled
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setScheduledCells(new Set());
                    }}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Clear All
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setScheduledCells(new Set(availableCells.map(cell => cell.cell_number)));
                    }}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Select All
                  </button>
                </div>
              </div>

              <div className="common-modal-buttons" style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '12px',
                marginTop: '20px'
              }}>
                <button 
                  type="button" 
                  onClick={() => setShowScheduleModal(false)}
                  style={{
                    background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
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
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
