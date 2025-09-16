import React, { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { VisitorContext } from '../context/VisitorContext';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import './common.css';
import './VisitorPage.css';
import './VisitorPageIdPreview.css';
import Header from './Header';
import { QRCodeCanvas } from 'qrcode.react';
import ID_Background from '../assets/ID_Background.png';
import { toPng } from 'html-to-image';

const VisitorPage = () => {
  const { pdlId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Function to get today's date in yyyy-mm-dd format for max attribute
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [pdl, setPdl] = useState(location.state?.pdl || null);
  // eslint-disable-next-line no-unused-vars
  const { visitorData, loading, error } = useContext(VisitorContext);
  const [visitors, setVisitors] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [visitorForm, setVisitorForm] = useState({
    name: '',
    relationship: '',
    age: '',
    address: '',
    valid_id: '',
    date_of_application: '',
    contact_number: ''
  });
  const [editingVisitorId, setEditingVisitorId] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [pdlFetchError, setPdlFetchError] = useState(null);

  // New states for Create ID feature
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedVisitorIds, setSelectedVisitorIds] = useState([]);
  const [showIdPreview, setShowIdPreview] = useState(false);
  const idPreviewRef = useRef(null);

  // New states for photo capture feature
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraVisitorId, setCameraVisitorId] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState({}); // visitorId -> photo data URL
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const fetchVisitors = useCallback(async () => {
    try {
      console.log(`Fetching visitors for PDL ID: ${pdlId}`);
      const res = await api.get(`/api/pdls/${pdlId}/visitors`);
      console.log('Visitors fetched:', res.data);
      const visitorsWithFormattedDate = res.data.map(visitor => ({
        ...visitor,
        date_of_application: visitor.date_of_application || '',
      }));
      setVisitors(visitorsWithFormattedDate);
      setFetchError(null);
    } catch (err) {
      console.error('Failed to fetch visitors:', err);
      setFetchError('Failed to fetch visitors. Please try again later.');
      setVisitors([]);
    }
  }, [pdlId]);

  useEffect(() => {
    if (!pdl) {
      console.log(`Fetching PDL data for ID: ${pdlId}`);
      api.get(`/pdls/${pdlId}`).then(res => {
        if (res.data) {
          console.log('PDL data fetched:', res.data);
          setPdl(res.data);
          setPdlFetchError(null);
        } else {
          setPdl({ first_name: 'Unknown', last_name: 'PDL' });
          setPdlFetchError('PDL data not found.');
        }
      }).catch(err => {
        console.error('Failed to fetch PDL:', err);
        setPdl({ first_name: 'Unknown', last_name: 'PDL' });
        setPdlFetchError('Failed to fetch PDL data. Please try again later.');
      });
    }
    fetchVisitors();
  }, [pdlId, pdl, fetchVisitors]);

  const resetForm = () => {
    setVisitorForm({
      name: '',
      relationship: '',
      age: '',
      address: '',
      valid_id: '',
      date_of_application: '',
      contact_number: ''
    });
  };

  // Helpers for input validation/formatting
  const toTitleCase = (value) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const normalizeRelationship = (value) => {
    if (!value) return '';
    const lettersAndSpaces = value.replace(/[^A-Za-z\s]/g, ' ');
    return toTitleCase(lettersAndSpaces);
  };

  const normalizeAddress = (value) => toTitleCase(value || '');

  const normalizeContactNumber = (value) => {
    if (!value) return '';
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits;
  };

  const clampAge = (value) => {
    if (value === '' || value === null || value === undefined) return '';
    const num = Math.max(0, Math.min(150, parseInt(value, 10) || 0));
    return String(num);
  };

  const handleAddVisitor = async (e) => {
    e.preventDefault();
    const contact = normalizeContactNumber(visitorForm.contact_number);
    if (!/^09\d{9}$/.test(contact)) {
      alert('Contact number must be 11 digits and start with 09.');
      return;
    }
    const payload = {
      ...visitorForm,
      relationship: normalizeRelationship(visitorForm.relationship),
      address: normalizeAddress(visitorForm.address),
      contact_number: contact,
      age: clampAge(visitorForm.age)
    };
    try {
      const response = await api.post(`/api/pdls/${pdlId}/visitors`, payload);
      alert(response.data.message || 'Visitor added successfully');
      setShowAddModal(false);
      resetForm();
      await fetchVisitors();
    } catch (err) {
      console.error('Error adding visitor:', err);
      if (err.response) {
        console.error('Response data:', err.response.data);
        alert(err.response.data.error || 'Failed to add visitor');
      } else if (err.request) {
        console.error('Request:', err.request);
        alert('No response received from server');
      } else {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleEditVisitor = async (e) => {
    e.preventDefault();
    const contact = normalizeContactNumber(visitorForm.contact_number);
    if (!/^09\d{9}$/.test(contact)) {
      alert('Contact number must be 11 digits and start with 09.');
      return;
    }
    const payload = {
      ...visitorForm,
      relationship: normalizeRelationship(visitorForm.relationship),
      address: normalizeAddress(visitorForm.address),
      contact_number: contact,
      age: clampAge(visitorForm.age)
    };
    try {
      await api.put(`/api/visitors/${editingVisitorId}`, payload);
      alert('Visitor updated successfully');
      setShowEditModal(false);
      resetForm();
      setEditingVisitorId(null);
      await fetchVisitors();
    } catch (err) {
      console.error('Error editing visitor:', err);
      alert('Failed to edit visitor');
    }
  };

  const handleDeleteVisitor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this visitor?')) return;
    try {
      await api.delete(`/api/visitors/${id}`);
      alert('Visitor deleted successfully');
      await fetchVisitors();
    } catch (err) {
      console.error('Error deleting visitor:', err);
      alert('Failed to delete visitor');
    }
  };

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForTable = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const openEditModal = (visitor) => {
    setVisitorForm({
      name: visitor.name || '',
      relationship: visitor.relationship || '',
      age: visitor.age || '',
      address: visitor.address || '',
      valid_id: visitor.valid_id || '',
      date_of_application: formatDateForInput(visitor.date_of_application),
      contact_number: visitor.contact_number || ''
    });
    setEditingVisitorId(visitor.id);
    setShowEditModal(true);
  };

  // Handler for toggling selection mode
  const handleCreateIdClick = () => {
    setIsSelecting(true);
    setSelectedVisitorIds([]);
  };

  // Handler for checkbox change
  const handleCheckboxChange = (visitorId) => {
    setSelectedVisitorIds((prevSelected) => {
      if (prevSelected.includes(visitorId)) {
        return prevSelected.filter(id => id !== visitorId);
      } else {
        return [...prevSelected, visitorId];
      }
    });
  };

  // Handler for cancel button
  const handleCancelSelection = () => {
    setIsSelecting(false);
    setSelectedVisitorIds([]);
  };

  // Handler for confirm button
  const handleConfirmSelection = () => {
    if (selectedVisitorIds.length === 0) {
      alert('Please select at least one visitor to create ID.');
      return;
    }
    setShowIdPreview(true);
    setIsSelecting(false);
  };

  // Close ID preview
  const handleCloseIdPreview = () => {
    setShowIdPreview(false);
    setSelectedVisitorIds([]);
  };

  // Open camera modal for a specific visitor
  const openCameraForVisitor = (visitorId) => {
    setCameraVisitorId(visitorId);
    setShowCameraModal(true);
  };

  // Close camera modal and stop camera stream
  const closeCameraModal = () => {
    setShowCameraModal(false);
    setCameraVisitorId(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera stream when modal opens
  useEffect(() => {
    if (showCameraModal) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        } catch (err) {
          alert('Could not access the camera. Please check permissions.');
          closeCameraModal();
        }
      };
      startCamera();
    } else {
      // Stop camera when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [showCameraModal]);

  // Capture photo from video stream
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedPhotos(prev => ({
      ...prev,
      [cameraVisitorId]: dataUrl
    }));
    closeCameraModal();
  };

  // Get selected visitors data
  const selectedVisitors = visitors.filter(visitor => selectedVisitorIds.includes(visitor.id));

  return (
    <div className="common-container">
      <Header activePage="Visitors" />

      <main>
        <button
          onClick={() => navigate(-1)}
          className="back-link"
          style={{ color: 'black', fontWeight: 'bold', textDecoration: 'none', background: '#e0e0e0', border: '1px solid #ccc', cursor: 'pointer', padding: '5px 10px', fontSize: '1rem', borderRadius: '4px' }}
          aria-label="Go back"
        >
          ← Back to PDLs
        </button>
        <h2>Visitors for {pdl ? `${pdl.first_name} ${pdl.last_name}` : 'Loading PDL data...'}</h2>
        {pdlFetchError && <p style={{ color: 'red' }}>{pdlFetchError}</p>}
        {fetchError && <p style={{ color: 'red' }}>{fetchError}</p>}

        <button className="common-button add" onClick={() => setShowAddModal(true)}>Add Visitor</button>

        <div className="visitor-table-wrapper">
          <table className="common-table">
            <thead>
              <tr>
                {isSelecting && <th>Select</th>}
                <th>Name</th>
                <th>Relationship</th>
                <th>Age</th>
                <th>Address</th>
                <th>Valid ID</th>
                <th>Date of Application</th>
                <th>Contact Number</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visitors.length === 0 ? (
                <tr>
                  <td colSpan={isSelecting ? "9" : "8"} className="no-visitors">No visitors yet</td>
                </tr>
              ) : (
                visitors.map(visitor => (
                  <tr key={visitor.id}>
                    {isSelecting && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedVisitorIds.includes(visitor.id)}
                          onChange={() => handleCheckboxChange(visitor.id)}
                        />
                      </td>
                    )}
                    <td>{visitor.name}</td>
                    <td>{visitor.relationship}</td>
                    <td>{visitor.age}</td>
                    <td>{visitor.address}</td>
                    <td>{visitor.valid_id}</td>
                    <td>{formatDateForTable(visitor.date_of_application)}</td>
                    <td>{visitor.contact_number}</td>
                    <td>
                      <button className="common-button edit" onClick={() => openEditModal(visitor)}>Edit</button>
                      <button className="common-button delete" onClick={() => handleDeleteVisitor(visitor.id)} style={{ marginLeft: '5px' }}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isSelecting && !showIdPreview && (
          <button className="common-button" style={{ marginTop: '10px' }} onClick={handleCreateIdClick}>Create ID</button>
        )}

        {isSelecting && (
          <div style={{ marginTop: '10px' }}>
            <button className="common-button" onClick={handleConfirmSelection}>Confirm</button>{' '}
            <button className="common-button" onClick={handleCancelSelection}>Cancel</button>
          </div>
        )}

        {showAddModal && (
          <div className="common-modal">
            <div className="common-modal-content">
              <h3>Add Visitor</h3>
              <form onSubmit={handleAddVisitor}>
                <label>Name:</label>
                <input
                  type="text"
                  placeholder=""
                  value={visitorForm.name}
                  onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })}
                  required
                />
                <label>Relationship:</label>
                <input
                  type="text"
                  placeholder=""
                  value={visitorForm.relationship}
                  onChange={(e) => setVisitorForm({ ...visitorForm, relationship: normalizeRelationship(e.target.value) })}
                  required
                />
                <label>Age:</label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  placeholder=""
                  value={visitorForm.age}
                  onChange={(e) => setVisitorForm({ ...visitorForm, age: clampAge(e.target.value) })}
                  required
                />
                <label>Address:</label>
                <input
                  type="text"
                  placeholder=""
                  value={visitorForm.address}
                  onChange={(e) => setVisitorForm({ ...visitorForm, address: e.target.value })}
                  required
                />
                <label>Valid ID:</label>
                <input
                  type="text"
                  placeholder=""
                  value={visitorForm.valid_id}
                  onChange={(e) => setVisitorForm({ ...visitorForm, valid_id: e.target.value })}
                  required
                />
                <label>Date of Application:</label>
                <input
                  type="date"
                  value={visitorForm.date_of_application}
                  max={getTodayDate()}
                  onChange={(e) => setVisitorForm({ ...visitorForm, date_of_application: e.target.value })}
                  required
                />
                <label>Contact Number:</label>
                <input
                  type="text"
                  placeholder=""
                  value={visitorForm.contact_number}
                  onChange={(e) => setVisitorForm({ ...visitorForm, contact_number: normalizeContactNumber(e.target.value) })}
                  pattern="09\\d{9}"
                  inputMode="numeric"
                  maxLength={11}
                  title="Contact number must be 11 digits and start with 09"
                  required
                />
                <div className="common-modal-buttons">
                  <button type="submit">Submit</button>
                  <button type="button" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="common-modal">
            <div className="common-modal-content">
              <h3>Edit Visitor</h3>
              <form onSubmit={handleEditVisitor}>
                <label>Name:</label>
                <input
                  type="text"
                  placeholder="Name"
                  value={visitorForm.name}
                  onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })}
                  required
                />
                <label>Relationship:</label>
                <input
                  type="text"
                  placeholder="Relationship"
                  value={visitorForm.relationship}
                  onChange={(e) => setVisitorForm({ ...visitorForm, relationship: normalizeRelationship(e.target.value) })}
                  required
                />
                <label>Age:</label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  placeholder="Age"
                  value={visitorForm.age}
                  onChange={(e) => setVisitorForm({ ...visitorForm, age: clampAge(e.target.value) })}
                  required
                />
                <label>Address:</label>
                <input
                  type="text"
                  placeholder="Address"
                  value={visitorForm.address}
                  onChange={(e) => setVisitorForm({ ...visitorForm, address: e.target.value })}
                  required
                />
                <label>Valid ID:</label>
                <input
                  type="text"
                  placeholder="Valid ID"
                  value={visitorForm.valid_id}
                  onChange={(e) => setVisitorForm({ ...visitorForm, valid_id: e.target.value })}
                  required
                />
                <label>Date of Application:</label>
                <input
                  type="date"
                  value={visitorForm.date_of_application}
                  max={getTodayDate()}
                  onChange={(e) => setVisitorForm({ ...visitorForm, date_of_application: e.target.value })}
                  required
                />
                <label>Contact Number:</label>
                <input
                  type="text"
                  placeholder="Contact Number"
                  value={visitorForm.contact_number}
                  onChange={(e) => setVisitorForm({ ...visitorForm, contact_number: normalizeContactNumber(e.target.value) })}
                  pattern="09\\d{9}"
                  inputMode="numeric"
                  maxLength={11}
                  title="Contact number must be 11 digits and start with 09"
                  required
                />
                <div className="common-modal-buttons">
                  <button type="submit">Submit</button>
                  <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showIdPreview && (
          <div style={{ marginTop: '20px' }}>
            <h3>ID Preview</h3>
            <div style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '15px', boxShadow: '0 0 10px rgba(0,0,0,0.1)', backgroundColor: 'white' }}>
              <div id="id-preview-container" ref={idPreviewRef} style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                {selectedVisitors.map(visitor => (
                  <div key={visitor.id} className="id-card" style={{ width: 408 * 1.3 + 'px', height: 324 * 1.3 + 'px', position: 'relative', backgroundColor: 'transparent', display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                    {/* Background image layer covering entire card */}
                    <div className="id-card-background" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', padding: 0, overflow: 'hidden', width: '100%', height: '100%' }}>
                      <img src={ID_Background} alt="ID Background Left" className="left" style={{ width: '50%', height: '100%', objectFit: 'cover', flexShrink: 0, borderRadius: '8px 0 0 8px' }} />
                      <img src={ID_Background} alt="ID Background Right" className="right" style={{ width: '50%', height: '100%', objectFit: 'cover', flexShrink: 0, borderRadius: '0 8px 8px 0' }} />
                    </div>
                    {/* Left side - Visitor info */}
                    <div style={{ width: 204 * 1.3 + 'px', height: 324 * 1.3 + 'px', position: 'relative', backgroundColor: 'transparent', flexDirection: 'column', justifyContent: 'space-between', display: 'flex', zIndex: 1 }}>
                      <div className="id-card-side left" style={{ position: 'relative', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', width: '100%', flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', textAlign: 'center', marginBottom: '5px' }}>Silang Municipal Jail</div>
                        <div className="id-card-logos" style={{ display: 'flex', justifyContent: 'center', padding: 0, gap: '5px', width: '100%' }}>
                          <img src="/logo1.png" alt="Logo 1" style={{ margin: 0, width: '65px', height: '65px', objectFit: 'contain' }} />
                          <img src="/logo2.png" alt="Logo 2" style={{ margin: 0, width: '65px', height: '65px', objectFit: 'contain' }} />
                          <img src="/logo3.png" alt="Logo 3" style={{ margin: 0, width: '66px', height: '66px', objectFit: 'contain' }} />
                        </div>
                        <div className="id-card-title" style={{ fontWeight: 'bold', marginTop: '5px', marginBottom: '10px', fontSize: '1rem', textAlign: 'center' }}>Visitator's Identification Card</div>
                        <div className="id-card-photo-placeholder" style={{ width: '150px', height: '150px', backgroundColor: '#ccc', margin: '10px auto', display: 'block', flexShrink: 0, textAlign: 'center', lineHeight: '150px', fontWeight: 'bold', color: '#666' }}>
                          {capturedPhotos[visitor.id] ? (
                            <img src={capturedPhotos[visitor.id]} alt="Captured" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '4px' }} />
                          ) : (
                            '2x2 Photo'
                          )}
                        </div>
                        <div style={{ textAlign: 'center', fontWeight: 'bold', marginTop: '5px' }}>Visitor</div>
                        <div className="id-card-info" style={{ fontSize: '0.9rem', marginTop: '5px', textAlign: 'center' }}>
                          <div><strong>ID: {visitor.visitor_id}</strong></div>
                          <div><strong>{visitor.name}</strong></div>
                          <div className="address">{visitor.address}</div>
                          <div>{visitor.relationship}</div>
                        </div>
                      </div>
                      <div className="id-card-side right" style={{ position: 'relative', padding: '10px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', width: '100%', flex: 1, marginTop: '10px' }}>
                        <div className="id-card-info" style={{ fontSize: '0.9rem', marginTop: '5px', textAlign: 'center' }}>
                        </div>
                        <div className="id-card-qr" style={{ backgroundColor: 'transparent', padding: '5px', objectFit: 'fill', position: 'relative', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        </div>
                        {/* Removed Contact No. from first side as requested */}
                      </div>
                    </div>
                    {/* Right side - Duplicate design with PDL info */}
                    <div style={{ width: 204 * 1.3 + 'px', height: 324 * 1.3 + 'px', position: 'relative', backgroundColor: 'transparent', flexDirection: 'column', justifyContent: 'space-between', display: 'flex', borderLeft: '1px solid #ccc', padding: '10px', boxSizing: 'border-box', zIndex: 1 }}>
                      <div className="id-card-title" style={{ fontWeight: 'bold', marginTop: '5px', marginBottom: '10px', fontSize: '1rem', textAlign: 'center' }}>PDL to be Visit</div>
                      <div className="id-card-info" style={{ fontSize: '0.9rem', marginTop: '5px', textAlign: 'center' }}>
                        <div><strong>Name:</strong> {pdl ? `${pdl.first_name} ${pdl.last_name}` : ''}</div>
                        <div><strong>Dorm No:</strong> {pdl ? pdl.dorm_number : ''}</div>
                      </div>
                      <div className="id-card-qr" style={{ backgroundColor: 'transparent', padding: '5px', objectFit: 'fill', position: 'relative', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <QRCodeCanvas
                          value={`[visitor_id:${visitor.id}][Visitor: ${visitor.name}][Relationship: ${visitor.relationship}][Contact: ${visitor.contact_number}][PDL: ${pdl ? `${pdl.first_name} ${pdl.last_name}` : ''}][Dorm: ${pdl ? pdl.dorm_number : ''}]`}
                          size={166}
                        />
                      </div>
                      <div className="id-card-contact" style={{ fontSize: '0.9rem', marginTop: '10px', textAlign: 'center' }}>
                        <strong>Contact No.</strong><br />
                        {visitor.contact_number}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '10px' }}>
              <button className="common-button" onClick={handleCloseIdPreview}>Close Preview</button>{' '}
              <button className="common-button" onClick={() => {
                try {
                  const container = document.getElementById('id-preview-container');
                  if (!container) {
                    alert('ID preview container not found.');
                    return;
                  }

                  document.body.classList.add('print-only-id-preview');

                  // Listen for afterprint event to remove the class
                  const removePrintClass = () => {
                    document.body.classList.remove('print-only-id-preview');
                    window.removeEventListener('afterprint', removePrintClass);
                  };
                  window.addEventListener('afterprint', removePrintClass);

                  // Trigger print directly
                  window.print();
                } catch (error) {
                  console.error('Print error:', error);
                  alert('An error occurred while trying to print. Please try again.');
                }
              }}>Print Selected IDs</button>{' '}
              <button className="common-button" onClick={() => {
                if (selectedVisitorIds.length !== 1) {
                  alert('Please select exactly one visitor to add a photo.');
                  return;
                }
                openCameraForVisitor(selectedVisitorIds[0]);
              }}>Add a photo</button>{' '}
              <button className="common-button" onClick={() => {
                if (selectedVisitorIds.length !== 1) {
                  alert('Please select exactly one visitor to save.');
                  return;
                }
                const container = document.getElementById('id-preview-container');
                if (!container) {
                  alert('ID preview container not found.');
                  return;
                }
                toPng(container, { pixelRatio: 3 })
                  .then((dataUrl) => {
                    const link = document.createElement('a');
                    const visitorName = selectedVisitors[0]?.name || 'visitor_id';
                    const safeName = visitorName.replace(/\s+/g, '_');
                    link.download = `${safeName}_ID.png`;
                    link.href = dataUrl;
                    link.click();
                  })
                  .catch((error) => {
                    console.error('Error saving image:', error);
                    alert('Failed to save visitor ID as image.');
                  });
              }}>Save</button>
            </div>
          </div>
        )}

        {/* Camera Modal */}
        {showCameraModal && (
          <div className="modal fade show" style={{ display: 'block' }} tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog" role="document" style={{ maxWidth: '400px' }}>
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Capture Photo</h5>
                  <button type="button" className="close" aria-label="Close" onClick={closeCameraModal}>
                    <span aria-hidden="true">&times;</span>
                  </button>
                </div>
                <div className="modal-body" style={{ textAlign: 'center' }}>
                  <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '8px' }} />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
                <div className="modal-footer">
                  <button className="btn btn-primary" onClick={capturePhoto}>Capture</button>
                  <button className="btn btn-secondary" onClick={closeCameraModal}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default VisitorPage;
