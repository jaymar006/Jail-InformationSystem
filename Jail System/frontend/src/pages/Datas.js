import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from '../services/api';
import * as XLSX from 'xlsx';
import './common.css';
import Header from './Header';

const formatDateOnly = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

// Capitalize the first letter of each word, lowercasing the rest
const capitalizeWords = (value) => {
  if (!value) return '';
  return value
    .split(' ')
    .map(word => word ? (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) : '')
    .join(' ');
};

const exportVisitorsToExcel = async (pdls) => {
  try {
    console.log('Exporting visitors for pdls in order:', pdls.map(p => p.id));
    const response = await axios.get('/api/visitors');
    const visitors = response.data;

    // Group visitors by pdl id
    const visitorsByPdl = visitors.reduce((acc, visitor) => {
      const pdlId = visitor.pdl_id;
      if (!acc[pdlId]) {
        acc[pdlId] = [];
      }
      acc[pdlId].push(visitor);
      return acc;
    }, {});

    // Prepare data for export with pdl name shown once, and include pdls with no visitors
    const dataToExport = [];

    pdls.forEach(pdl => {
      const pdlVisitors = visitorsByPdl[pdl.id] || [];
      if (pdlVisitors.length === 0) {
        // Include pdl with no visitors
        dataToExport.push({
          'PDL Name': `${pdl.last_name || ''}, ${pdl.first_name || ''} ${pdl.middle_name || ''}`.trim(),
          'Visitor Name': '',
          'Relationship': '',
          'Age': '',
          'Address': '',
          'Valid ID': '',
          'Date of Application': '',
          'Contact Number': '',
        });
      } else {
        // Sort visitors by name alphabetically
        const sortedVisitors = pdlVisitors.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        sortedVisitors.forEach((visitor, index) => {
          dataToExport.push({
            'PDL Name': index === 0 ? `${pdl.last_name || ''}, ${pdl.first_name || ''} ${pdl.middle_name || ''}`.trim() : '',
            'Visitor Name': visitor.name || '',
            'Relationship': visitor.relationship || '',
            'Age': visitor.age || '',
            'Address': visitor.address || '',
            'Valid ID': visitor.valid_id || '',
            'Date of Application': formatDateOnly(visitor.date_of_application),
            'Contact Number': visitor.contact_number || '',
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths to fit content approximately (no compression)
    worksheet['!cols'] = [
      { wch: 20 }, // PDL Name
      { wch: 20 }, // Visitor Name
      { wch: 15 }, // Relationship
      { wch: 10 }, // Age
      { wch: 30 }, // Address
      { wch: 20 }, // Valid ID
      { wch: 20 }, // Date of Application
      { wch: 20 }, // Contact Number
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[cellAddress]) continue;
      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      worksheet[cellAddress].s.font = { bold: true };
      worksheet[cellAddress].s.alignment = { horizontal: "left" };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitors');
    XLSX.writeFile(workbook, 'Visitors_export.xlsx');
  } catch (error) {
    console.error('Failed to export visitors:', error);
    alert('Failed to export visitors');
  }
};

const Datas = () => {
  const [pdls, setPdls] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState('none');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Initialize sortOption from URL query param
  useEffect(() => {
    const sort = searchParams.get('sort');
    if (sort) {
      setSortOption(sort);
    }
  }, [searchParams]);

  // Update URL query param when sortOption changes
  useEffect(() => {
    if (sortOption && sortOption !== 'none') {
      setSearchParams({ sort: sortOption });
    } else {
      setSearchParams({});
    }
  }, [sortOption, setSearchParams]);

  // Reset current page to 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    dorm_number: '',
    criminal_case_no: '',
    offense_charge: '',
    court_branch: '',
    arrest_date: '',
    commitment_date: '',
    first_time_offender: 'No',
  });

  const openEditModal = (pdl) => {
    const normalizedPdl = {
      ...pdl,
      first_time_offender: pdl.first_time_offender === 1 || pdl.first_time_offender === '1' ? 'Yes' : 'No',
      middle_name: pdl.middle_name || '',
    };
    setEditForm(normalizedPdl);
    setShowEditModal(true);
  };

  useEffect(() => {
    fetchPdls();
  }, []);

  const fetchPdls = async () => {
    try {
      const res = await axios.get('/pdls');
      const pdlsWithFormattedDates = res.data.map(pdl => {
        const formatLocalDate = (dateStr) => {
          if (!dateStr) return '';
          const date = new Date(dateStr);
          // Get local date components
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        return {
          ...pdl,
          arrest_date: formatLocalDate(pdl.arrest_date),
          commitment_date: formatLocalDate(pdl.commitment_date),
        };
      });
      setPdls(pdlsWithFormattedDates);
    } catch (err) {
      console.error('Failed to fetch PDLs:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[1]}/${parts[2]}/${parts[0]}`;
  };

  const handlePdlClick = (pdl) => {
    navigate(`/visitors/${pdl.id}`, { state: { pdl } });
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...addForm,
        first_time_offender: addForm.first_time_offender === 'Yes' ? 1 : 0,
      };
      await axios.post('/pdls', payload);
      fetchPdls();
      setShowAddModal(false);
      setAddForm({
        last_name: '',
        first_name: '',
        middle_name: '',
        dorm_number: '',
        criminal_case_no: '',
        offense_charge: '',
        court_branch: '',
        arrest_date: '',
        commitment_date: '',
        first_time_offender: 'No',
      });
      alert('PDL Successfully Added ');
    } catch (err) {
      console.error('Failed to add PDL:', err.response?.data || err.message);
      alert('Failed to add PDL');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...editForm,
        middle_name: editForm.middle_name || '',
        first_time_offender: editForm.first_time_offender === 'Yes' ? 1 : 0,
      };
      await axios.put(`/pdls/${editForm.id}`, payload);
      fetchPdls();
      setShowEditModal(false);
    } catch (err) {
      console.error('Failed to update PDL:', err);
      alert(err.response?.data?.error || 'Failed to update PDL');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this PDL?')) return;
    try {
      await axios.delete(`/pdls/${id}`);
      fetchPdls();
      alert('PDL successfully deleted.');
    } catch (err) {
      console.error('Failed to delete PDL:', err);
      alert(err.response?.data?.error || 'Failed to delete PDL.');
    }
  };

  const filteredSortedPdls = pdls
    .filter((pdl) => {
      const term = searchTerm.toLowerCase();
      return (
        pdl.last_name.toLowerCase().includes(term) ||
        pdl.first_name.toLowerCase().includes(term) ||
        (pdl.middle_name && pdl.middle_name.toLowerCase().includes(term)) ||
        (pdl.criminal_case_no && pdl.criminal_case_no.toLowerCase().includes(term)) ||
        (pdl.offense_charge && pdl.offense_charge.toLowerCase().includes(term)) ||
        (pdl.court_branch && pdl.court_branch.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => {
      const dormA = parseInt(a.dorm_number, 10) || 0;
      const dormB = parseInt(b.dorm_number, 10) || 0;
      if (sortOption === 'dorm') {
        return dormA - dormB;
      } else if (sortOption === 'alphabetical') {
        if (dormA !== dormB) return dormA - dormB;
        return a.last_name.localeCompare(b.last_name);
      } else if (sortOption === 'alphabeticalWithDorm') {
        const lastNameCompare = a.last_name.localeCompare(b.last_name);
        if (lastNameCompare !== 0) return lastNameCompare;
        return dormA - dormB;
      }
      return 0;
    });

  const totalPages = Math.ceil(filteredSortedPdls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPdls = filteredSortedPdls.slice(startIndex, startIndex + itemsPerPage);

  const exportToExcel = () => {
    const dataToExport = filteredSortedPdls.map(pdl => ({
      'Last Name': pdl.last_name,
      'First Name': pdl.first_name,
      'Middle Name': pdl.middle_name,
      'Dorm Number': pdl.dorm_number,
      'Criminal Case No.': pdl.criminal_case_no,
      'Offense Charge': pdl.offense_charge,
      'Court Branch': pdl.court_branch,
      'Date of Arrest': formatDate(pdl.arrest_date),
      'Date of Commitment': formatDate(pdl.commitment_date),
      'First Time Offender': pdl.first_time_offender === 1 || pdl.first_time_offender === '1' ? 'Yes' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths to fit content approximately
    worksheet['!cols'] = [
      { wch: 15 }, // Last Name
      { wch: 15 }, // First Name
      { wch: 15 }, // Middle Name
      { wch: 12 }, // Dorm Number
      { wch: 20 }, // Criminal Case No.
      { wch: 30 }, // Offense Charge
      { wch: 20 }, // Court Branch
      { wch: 15 }, // Date of Arrest
      { wch: 15 }, // Date of Commitment
      { wch: 18 }, // First Time Offender
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[cellAddress]) continue;
      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      worksheet[cellAddress].s.font = { bold: true };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PDLs');
    XLSX.writeFile(workbook, 'PDLs_export.xlsx');
  };

const exportVisitorsToExcel = async () => {
  try {
    const response = await axios.get('/api/visitors');
    const visitors = response.data;

    const formatDateOnly = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };

    // Group visitors by pdl id
    const visitorsByPdl = visitors.reduce((acc, visitor) => {
      const pdlId = visitor.pdl_id;
      if (!acc[pdlId]) {
        acc[pdlId] = [];
      }
      acc[pdlId].push(visitor);
      return acc;
    }, {});

    // Sort pdls by last_name alphabetically before export
    const sortedPdls = [...pdls].sort((a, b) => {
      const lastNameA = (a.last_name || '').toLowerCase();
      const lastNameB = (b.last_name || '').toLowerCase();
      if (lastNameA < lastNameB) return -1;
      if (lastNameA > lastNameB) return 1;
      return 0;
    });

    // Prepare data for export with pdl name shown once, and include pdls with no visitors
    const dataToExport = [];

    sortedPdls.forEach(pdl => {
      let pdlVisitors = visitorsByPdl[pdl.id] || [];
      if (pdlVisitors.length === 0) {
        // Include pdl with no visitors
        dataToExport.push({
          'PDL Name': `${pdl.last_name || ''}, ${pdl.first_name || ''} ${pdl.middle_name || ''}`.trim(),
          'Visitor Name': '',
          'Relationship': '',
          'Age': '',
          'Address': '',
          'Valid ID': '',
          'Date of Application': '',
          'Contact Number': '',
        });
      } else {
        // Sort visitors by name alphabetically
        pdlVisitors = pdlVisitors.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return 0;
        });
        pdlVisitors.forEach((visitor, index) => {
          dataToExport.push({
            'PDL Name': index === 0 ? `${pdl.last_name || ''}, ${pdl.first_name || ''} ${pdl.middle_name || ''}`.trim() : '',
            'Visitor Name': visitor.name || '',
            'Relationship': visitor.relationship || '',
            'Age': visitor.age || '',
            'Address': visitor.address || '',
            'Valid ID': visitor.valid_id || '',
            'Date of Application': formatDateOnly(visitor.date_of_application),
            'Contact Number': visitor.contact_number || '',
          });
        });
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Set column widths to fit content approximately (no compression)
    worksheet['!cols'] = [
      { wch: 20 }, // PDL Name
      { wch: 20 }, // Visitor Name
      { wch: 15 }, // Relationship
      { wch: 10 }, // Age
      { wch: 30 }, // Address
      { wch: 20 }, // Valid ID
      { wch: 20 }, // Date of Application
      { wch: 20 }, // Contact Number
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[cellAddress]) continue;
      if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
      worksheet[cellAddress].s.font = { bold: true };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visitors');
    XLSX.writeFile(workbook, 'Visitors_export.xlsx');
  } catch (error) {
    console.error('Failed to export visitors:', error);
    alert('Failed to export visitors');
  }
};

  return (
    <div className="common-container">
      <Header activePage="Datas" />

      <main>
        <h2>PDL Visitors Management</h2>
        <div className="action-buttons">
          <button className="common-button add" type="button" onClick={() => setShowAddModal(true)}>Add a PDL</button>
          <button className="common-button export" type="button" onClick={exportToExcel}>Export PDL</button>
          <button className="common-button export" type="button" onClick={() => exportVisitorsToExcel(filteredSortedPdls)}>Export Visitors</button>
        </div>

        <h3>PDL Lists</h3>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px', alignItems: 'center', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '5px', fontSize: '14px', width: '200px' }}
          />
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            style={{ padding: '5px', fontSize: '14px' }}
            aria-label="Sort Options"
          >
            <option value="none">No Sort</option>
            <option value="dorm">Sort by Dorm</option>
            <option value="alphabetical">Sort Alphabetically with Dorm</option>
            <option value="alphabeticalWithDorm">Sort Alphabetically</option>
          </select>
          <div>
            Number of data in PDL: {pdls.length}
          </div>
        </div>
        <table className="common-table">
          <thead>
            <tr>
              <th>Last Name</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Dorm Number</th>
              <th>Criminal Case No.</th>
              <th>Offense Charge</th>
              <th>Court Branch</th>
              <th>Date of Arrest</th>
              <th>Date of Commitment</th>
              <th>First Time Offender</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentPdls.map((pdl) => (
              <tr key={pdl.id}>
                <td onClick={() => handlePdlClick(pdl)}>{pdl.last_name}</td>
                <td>{pdl.first_name}</td>
                <td>{pdl.middle_name}</td>
                <td>{pdl.dorm_number}</td>
                <td>{pdl.criminal_case_no}</td>
                <td>{pdl.offense_charge}</td>
                <td>{pdl.court_branch}</td>
                <td>{formatDate(pdl.arrest_date)}</td>
                <td>{formatDate(pdl.commitment_date)}</td>
                <td>{pdl.first_time_offender === 1 || pdl.first_time_offender === '1' ? 'Yes' : 'No'}</td>
                <td>
                  <div className="action-buttons-row">
                    <button className="common-button edit" onClick={() => openEditModal(pdl)}>Edit</button>
                    <button className="common-button delete" onClick={() => handleDelete(pdl.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination-container">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                className={`pagination-button ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
                aria-label={`Go to page ${pageNum}`}
              >
                {pageNum}
              </button>
            ))}
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="common-modal">
          <div className="common-modal-content wide">
            <h3>Add a PDL</h3>
            <form onSubmit={handleAddSubmit}>
              <div className="form-grid">
                <div className="form-row">
                  <div className="form-col">
                    <label>Last Name</label>
                    <input type="text" placeholder="Last Name" value={addForm.last_name} onChange={(e) => setAddForm({ ...addForm, last_name: capitalizeWords(e.target.value) })} required />
                  </div>
                  <div className="form-col">
                    <label>First Name</label>
                    <input type="text" placeholder="First Name" value={addForm.first_name} onChange={(e) => setAddForm({ ...addForm, first_name: capitalizeWords(e.target.value) })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col">
                    <label>Middle Name</label>
                    <input type="text" placeholder="Middle Name" value={addForm.middle_name} onChange={(e) => setAddForm({ ...addForm, middle_name: capitalizeWords(e.target.value) })} />
                  </div>
                  <div className="form-col">
                    <label>Dorm Number</label>
                    <input type="text" placeholder="Dorm Number" value={addForm.dorm_number} onChange={(e) => setAddForm({ ...addForm, dorm_number: e.target.value })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col">
                    <label>Criminal Case no.</label>
                    <input type="text" placeholder="Criminal Case no." value={addForm.criminal_case_no} onChange={(e) => setAddForm({ ...addForm, criminal_case_no: e.target.value })} />
                  </div>
                  <div className="form-col">
                    <label>Offense Charge</label>
                    <input type="text" placeholder="Offense Charge" value={addForm.offense_charge} onChange={(e) => setAddForm({ ...addForm, offense_charge: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col">
                    <label>Court Branch</label>
                    <input type="text" placeholder="Court Branch" value={addForm.court_branch} onChange={(e) => setAddForm({ ...addForm, court_branch: e.target.value })} />
                  </div>
                  <div className="form-col">
                    <label>First Time Offender</label>
                    <select value={addForm.first_time_offender} onChange={(e) => setAddForm({ ...addForm, first_time_offender: e.target.value })}>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-col">
                    <label>Arrest Date</label>
                    <input
                      type="date"
                      value={addForm.arrest_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setAddForm({ ...addForm, arrest_date: e.target.value })}
                    />
                  </div>
                  <div className="form-col">
                    <label>Commitment Date</label>
                    <input
                      type="date"
                      value={addForm.commitment_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setAddForm({ ...addForm, commitment_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

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
            <h3>Edit PDL</h3>
            <form onSubmit={handleEditSubmit}>
              <label>Last Name</label>
              <input type="text" placeholder="Last Name" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: capitalizeWords(e.target.value) })} required />
              <label>First Name</label>
              <input type="text" placeholder="First Name" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: capitalizeWords(e.target.value) })} required />
              <label>Middle Name</label>
              <input type="text" placeholder="Middle Name" value={editForm.middle_name} onChange={(e) => setEditForm({ ...editForm, middle_name: capitalizeWords(e.target.value) })} />
              <label>Dorm Number</label>
              <input type="text" placeholder="Dorm Number" value={editForm.dorm_number} onChange={(e) => setEditForm({ ...editForm, dorm_number: e.target.value })} required />
              <label>Criminal Case No.</label>
              <input type="text" placeholder="Criminal Case No." value={editForm.criminal_case_no} onChange={(e) => setEditForm({ ...editForm, criminal_case_no: e.target.value })} />
              <label>Offense Charge</label>
              <input type="text" placeholder="Offense Charge" value={editForm.offense_charge} onChange={(e) => setEditForm({ ...editForm, offense_charge: e.target.value })} />
              <label>Court Branch</label>
              <input type="text" placeholder="Court Branch" value={editForm.court_branch} onChange={(e) => setEditForm({ ...editForm, court_branch: e.target.value })} />
              <label>Arrest Date</label>
              <input
                type="date"
                value={editForm.arrest_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEditForm({ ...editForm, arrest_date: e.target.value })}
              />
              <label>Commitment Date</label>
              <input
                type="date"
                value={editForm.commitment_date}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setEditForm({ ...editForm, commitment_date: e.target.value })}
              />
              <label>
                First Time Offender:
                <select value={editForm.first_time_offender} onChange={(e) => setEditForm({ ...editForm, first_time_offender: e.target.value })}>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
              <div className="common-modal-buttons">
                <button type="submit">Submit</button>
                <button type="button" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export { Datas, exportVisitorsToExcel };
export default Datas;
