import React, { useState, useEffect } from 'react';
import Header from './Header';
import QRCodeScanner from '../components/QRCodeScanner';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [visitors, setVisitors] = useState([]);
  const [scanError, setScanError] = useState(null);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [scannedVisitorsSet, setScannedVisitorsSet] = useState(new Set());

  const [selectedVisitorId, setSelectedVisitorId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTimeIn, setEditTimeIn] = useState('');
  const [editTimeOut, setEditTimeOut] = useState('');

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

    const visitorKey = `[${visitorName}][${pdlName}][${dorm}]`;

    try {
      await api.post('/api/scanned_visitors', {
        visitor_name: visitorName,
        pdl_name: pdlName,
        dorm,
        relationship,
        contact_number: contactNumber
      });

      setScanError(null);

      if (scannedVisitorsSet.has(visitorKey)) {
        alert('Successful time out');
        setScannedVisitorsSet(prev => {
          const newSet = new Set(prev);
          newSet.delete(visitorKey);
          return newSet;
        });
      } else {
        alert('Successful time in');
        setScannedVisitorsSet(prev => new Set(prev).add(visitorKey));
      }

      fetchVisitors();
      setResetTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error adding scanned visitor:', error);
      setScanError('Error adding scanned visitor');
    }
  };

  const handleRowClick = (id) => {
    setSelectedVisitorId(id === selectedVisitorId ? null : id);
  };

  const openEditModal = () => {
    const visitor = visitors.find(v => v.id === selectedVisitorId);
    if (!visitor) {
      alert('Please select a valid visitor.');
      return;
    }

    setEditTimeIn(visitor.created_at ? addHours(visitor.created_at, 8).substring(11, 19) : '');
    setEditTimeOut(visitor.time_out ? addHours(visitor.time_out, 8).substring(11, 19) : '');
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
    v => getDateString(v.created_at) === currentDateString
  );

  const handleDelete = async () => {
    if (!selectedVisitorId) {
      alert('Please select a visitor to delete.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete the selected visitor?')) return;

    try {
      await api.delete(`/api/scanned_visitors/${selectedVisitorId}`);
      setSelectedVisitorId(null);
      fetchVisitors();
      alert('Record deleted successfully.');
    } catch (error) {
      console.error('Failed to delete visitor:', error);
      alert('Failed to delete visitor.');
    }
  };

  return (
    <div>
      <Header activePage="Dashboard" />
      <main className="dashboard-main">
        <section>
          <h2>QR Code Scanner</h2>
          <QRCodeScanner onScan={handleScan} onError={() => setScanError('QR Scan error')} resetTrigger={resetTrigger} />
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

            <button className="common-button" onClick={openEditModal} style={{ marginBottom: '10px', marginRight: '10px' }}>
              Manual Edit
            </button>
            <button className="common-button delete" onClick={handleDelete} style={{ marginBottom: '10px' }}>
              Delete
            </button>

            <table className="common-table">
              <thead>
                <tr>
                  <th>Visitor's Name</th>
                  <th>PDL's to be Visited</th>
                  <th>Dorm</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                </tr>
              </thead>
              <tbody>
                {filteredVisitors.length === 0 ? (
                  <tr><td colSpan="5">No records</td></tr>
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
                      <td>{capitalizeWords(v.visitor_name)}</td>
                      <td>{capitalizeWords(v.pdl_name)}</td>
                      <td>{capitalizeWords(v.dorm)}</td>
                      <td>{formatTime(v.created_at)}</td>
                      <td>{v.time_out ? formatTime(addHours(v.time_out, 8)) : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <button className="common-button" onClick={() => window.print()} style={{ marginTop: '10px' }}>
            Print Table
          </button>
        </section>

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
