import React, { useState, useEffect } from 'react';
import Header from './Header';
import QRCodeScanner from '../components/QRCodeScanner';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [visitors, setVisitors] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(0);

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

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const addHours = (isoString, hours) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    date.setHours(date.getHours() + hours);
    return date.toISOString();
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

  const fetchVisitors = async () => {
    try {
      const res = await api.get('/api/scanned_visitors');
      setVisitors(res.data);
      setScanError(null);
    } catch (error) {
      console.error('Failed to fetch visitors:', error);
      setScanError('Failed to fetch visitors data');
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const handleScan = async (data) => {
    if (!data) return;
    if (scanLocked) return;

    const regex = /\[(.*?)\]/g;
    const matches = [...data.matchAll(regex)].map(match => match[1]);

    let visitorName = '', pdlName = '', dorm = '', relationship = '', contactNumber = '';

    matches.forEach(part => {
      if (part.startsWith('Visitor:')) visitorName = part.replace('Visitor:', '').trim();
      else if (part.startsWith('PDL:')) pdlName = part.replace('PDL:', '').trim();
      else if (part.startsWith('Dorm:')) dorm = part.replace('Dorm:', '').trim();
      else if (part.startsWith('Relationship:')) relationship = part.replace('Relationship:', '').trim();
      else if (part.startsWith('Contact:')) contactNumber = part.replace('Contact:', '').trim();
    });

    if (!visitorName || !pdlName || !dorm) {
      setScanError('Invalid QR code format');
      return;
    }

    // Debounce same QR contents for a short window
    const sig = `${visitorName}|${pdlName}|${dorm}`;
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
        dorm,
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
          dorm,
          relationship,
          contact_number: contactNumber
        };
        await api.post('/api/scanned_visitors', {
          ...scanData,
          device_time: new Date().toISOString()
        });
        setScanError('Successful time out');
        await fetchVisitors();
        setTimeout(() => setScanLocked(false), 1200);
        return;
      }

      // Otherwise show modal for purpose selection (time in)
      setPendingScanData({
        visitor_name: visitorName,
        pdl_name: pdlName,
        dorm,
        relationship,
        contact_number: contactNumber
      });
      setShowPurposeModal(true);
    } catch (e) {
      console.error('Preflight scan error:', e);
      setScanError('Scan preflight failed');
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

      setScanError(null);

      const action = response?.data?.action;
      if (action === 'time_out') {
        setScanError('Successful time out');
      } else if (action === 'time_in') {
        setScanError('Successful time in');
      } else if (action === 'already_timed_out') {
        setScanError('This visitor has already timed out.');
      } else {
        setScanError('Scan recorded.');
      }

      fetchVisitors();
    } catch (error) {
      console.error('Error adding scanned visitor:', error);
      setScanError('Error adding scanned visitor');
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

  const openEditModal = () => {
    const visitor = visitors.find(v => v.id === selectedVisitorId);
    if (!visitor) {
      alert('Please select a valid visitor.');
      return;
    }

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
      <main className="dashboard-main">
        <section style={{ textAlign: 'center' }}>
          <h2>QR Code Scanner</h2>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <QRCodeScanner onScan={handleScan} onError={() => setScanError('QR Scan error')} resetTrigger={resetTrigger} />
          </div>
          {scanError && <p className="error-message">{scanError}</p>}
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
              {new Date().toLocaleDateString()}
            </b>
            <h2 style={{ textAlign: 'center' }}>Allowed Visitors</h2>


            <table className="common-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th>Visitor's Name</th>
                  <th>PDL's to be Visited</th>
                  <th>Dorm</th>
                  <th>Purpose</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.length === 0 ? (
                  <tr><td colSpan="8">No records</td></tr>
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
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedDeleteIds.includes(v.id)}
                          onChange={(e) => { e.stopPropagation(); handleToggleRowDelete(v.id); }}
                        />
                      </td>
                      <td>{capitalizeWords(v.visitor_name)}</td>
                      <td>{capitalizeWords(v.pdl_name)}</td>
                      <td>{capitalizeWords(v.dorm)}</td>
                      <td>{v.purpose ? (v.purpose.charAt(0).toUpperCase() + v.purpose.slice(1)) : ''}</td>
                      <td>{formatTime(v.time_in)}</td>
                      <td>{v.time_out ? formatTime(v.time_out) : ''}</td>
                      <td className="no-print">
                        <button
                          className="common-button edit no-print"
                          onClick={(e) => { e.stopPropagation(); openEditModalForRow(v); }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button className="common-button" onClick={() => window.print()}>
              Print Table
            </button>
            {selectedDeleteIds.length > 0 && (
              <button className="common-button delete" onClick={handleDelete}>
                Delete Selected ({selectedDeleteIds.length})
              </button>
            )}
          </div>
        </section>

        {/* Purpose Selection Modal */}
        {showPurposeModal && (
          <div className="common-modal">
            <div className="common-modal-content">
              <h3>Select Visit Purpose</h3>
              <p>Visitor: {pendingScanData?.visitor_name}</p>
              <p>PDL: {pendingScanData?.pdl_name}</p>
              <p>Dorm: {pendingScanData?.dorm}</p>
              <div style={{ marginTop: '20px' }}>
                <button 
                  className="common-button" 
                  onClick={() => handlePurposeSelection('conjugal')}
                  style={{ marginRight: '10px', backgroundColor: '#dc2626', color: 'white' }}
                >
                  Conjugal Visit
                </button>
                <button 
                  className="common-button" 
                  onClick={() => handlePurposeSelection('normal')}
                  style={{ backgroundColor: '#059669', color: 'white' }}
                >
                  Normal Visit
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
                  <button type="submit" className="common-button save">Save</button>
                  <button type="button" className="common-button cancel" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
