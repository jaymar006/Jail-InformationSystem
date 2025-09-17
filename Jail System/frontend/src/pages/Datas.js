import React, { useState, useEffect, useRef } from 'react';
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

// Normalize spaces: trim and collapse multiple spaces to single
const normalizeSpaces = (value) => String(value || '').replace(/\s+/g, ' ').trim();

// Capitalize the first letter of each word, lowercasing the rest
const capitalizeWords = (value) => {
  const normalized = normalizeSpaces(value);
  if (!normalized) return '';
  return normalized
    .split(' ')
    .map(word => word ? (word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) : '')
    .join(' ');
};

// Parse a date-like value from Excel to YYYY-MM-DD
const toYMD = (value) => {
  if (!value) return '';
  // If value is a Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, '0');
    const d = `${value.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // If value is a number (Excel serial)
  if (typeof value === 'number') {
    const date = XLSX.SSF ? XLSX.SSF.parse_date_code(value) : null;
    if (date) {
      const y = date.y;
      const m = `${date.m}`.padStart(2, '0');
      const d = `${date.d}`.padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  // If value is a string like MM/DD/YYYY or YYYY-MM-DD
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const mdY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdY) {
    const m = mdY[1].padStart(2, '0');
    const d = mdY[2].padStart(2, '0');
    const y = mdY[3];
    return `${y}-${m}-${d}`;
  }
  // Fallback: try Date
  const d2 = new Date(str);
  if (!isNaN(d2.getTime())) {
    const y = d2.getFullYear();
    const m = `${d2.getMonth() + 1}`.padStart(2, '0');
    const d = `${d2.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
};

// Parse PDL Name in the format "Last, First Middle" into parts
// Supports multi-word first names: treats the LAST token as middle name, the rest as first name
const parsePdlName = (full) => {
  const raw = normalizeSpaces(full);
  if (!raw) return { last_name: '', first_name: '', middle_name: '' };
  const [lastRaw, restRaw = ''] = raw.split(',');
  const last_name = capitalizeWords(normalizeSpaces(lastRaw));
  const rest = normalizeSpaces(restRaw);
  if (!rest) return { last_name, first_name: '', middle_name: '' };
  const parts = rest.split(' ');
  if (parts.length === 1) {
    return { last_name, first_name: capitalizeWords(parts[0]), middle_name: '' };
  }
  const middle_name = capitalizeWords(parts[parts.length - 1]);
  const first_name = capitalizeWords(parts.slice(0, -1).join(' '));
  return { last_name, first_name, middle_name };
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

    // Prepare data for export with separate PDL columns, and include pdls with no visitors
    const dataToExport = [];

    pdls.forEach(pdl => {
      const pdlVisitors = visitorsByPdl[pdl.id] || [];
      if (pdlVisitors.length === 0) {
        // Include pdl with no visitors
        dataToExport.push({
          'PDL Last Name': pdl.last_name || '',
          'PDL First Name': pdl.first_name || '',
          'PDL Middle Name': pdl.middle_name || '',
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
            'PDL Last Name': index === 0 ? (pdl.last_name || '') : '',
            'PDL First Name': index === 0 ? (pdl.first_name || '') : '',
            'PDL Middle Name': index === 0 ? (pdl.middle_name || '') : '',
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
      { wch: 18 }, // PDL Last Name
      { wch: 18 }, // PDL First Name
      { wch: 18 }, // PDL Middle Name
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

  // New: track column and direction for header sorting
  const [sortColumn, setSortColumn] = useState(null); // e.g., 'last_name'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  
  // New state for checkbox selection
  const [selectedPdlIds, setSelectedPdlIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // Filter states for Show Only functionality
  const [filterType, setFilterType] = useState('all'); // 'all', 'year', 'month', 'day'
  const [filterValue, setFilterValue] = useState('');

  const fileInputRef = useRef(null);
  const fileInputVisitorsRef = useRef(null);

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

  // Handle click on header to set sortColumn and toggle direction
  const onHeaderClick = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Handle individual checkbox change
  const handlePdlCheckboxChange = (pdlId) => {
    setSelectedPdlIds((prevSelected) => {
      if (prevSelected.includes(pdlId)) {
        return prevSelected.filter(id => id !== pdlId);
      } else {
        return [...prevSelected, pdlId];
      }
    });
  };

  // Handle select all checkbox change
  const handleSelectAllChange = () => {
    if (selectAll) {
      setSelectedPdlIds([]);
      setSelectAll(false);
    } else {
      setSelectedPdlIds(currentPdls.map(pdl => pdl.id));
      setSelectAll(true);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedPdlIds.length === 0) {
      alert('Please select at least one PDL to delete.');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${selectedPdlIds.length} PDL(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      // Delete each selected PDL
      const deletePromises = selectedPdlIds.map(id => axios.delete(`/pdls/${id}`));
      await Promise.all(deletePromises);
      
      alert(`${selectedPdlIds.length} PDL(s) successfully deleted.`);
      setSelectedPdlIds([]);
      setSelectAll(false);
      await fetchPdls();
    } catch (err) {
      console.error('Failed to delete PDLs:', err);
      alert('Failed to delete some PDLs. Please try again.');
    }
  };

  // Helper functions for Show Only filter
  const getUniqueYears = () => {
    const years = new Set();
    pdls.forEach(pdl => {
      if (pdl.arrest_date) {
        const year = new Date(pdl.arrest_date).getFullYear();
        years.add(year);
      }
      if (pdl.commitment_date) {
        const year = new Date(pdl.commitment_date).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  };

  const getUniqueMonths = (year) => {
    const months = new Set();
    pdls.forEach(pdl => {
      if (pdl.arrest_date) {
        const date = new Date(pdl.arrest_date);
        if (date.getFullYear() === year) {
          const month = date.getMonth() + 1; // getMonth() returns 0-11
          months.add(month);
        }
      }
      if (pdl.commitment_date) {
        const date = new Date(pdl.commitment_date);
        if (date.getFullYear() === year) {
          const month = date.getMonth() + 1; // getMonth() returns 0-11
          months.add(month);
        }
      }
    });
    return Array.from(months).sort((a, b) => b - a); // Sort descending (newest first)
  };

  const getUniqueDays = (year, month) => {
    const days = new Set();
    pdls.forEach(pdl => {
      if (pdl.arrest_date) {
        const date = new Date(pdl.arrest_date);
        if (date.getFullYear() === year && (date.getMonth() + 1) === month) {
          const day = date.getDate();
          days.add(day);
        }
      }
      if (pdl.commitment_date) {
        const date = new Date(pdl.commitment_date);
        if (date.getFullYear() === year && (date.getMonth() + 1) === month) {
          const day = date.getDate();
          days.add(day);
        }
      }
    });
    return Array.from(days).sort((a, b) => b - a); // Sort descending (newest first)
  };

  // Download template for PDL-only import
  const downloadPdlImportTemplate = () => {
    const headers = [
      'Last Name',
      'First Name',
      'Middle Name',
      'Dorm Number',
      'Criminal Case No.',
      'Offense Charge',
      'Court Branch',
      'Date of Arrest',
      'Date of Commitment',
      'First Time Offender',
    ];
    const sample = [
      ['Dela Cruz', 'Juan Denver', 'Dinglasan', '6', 'CC-1234', 'Theft', 'Branch 5', '01/15/2024', '02/01/2024', 'No']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    ws['!cols'] = [
      { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PDL Import Template');
    XLSX.writeFile(wb, 'PDL_Import_Template.xlsx');
  };

  // Download template for PDL with Visitors import (PDL fields + Visitor fields)
  const downloadPdlWithVisitorsTemplate = () => {
    const headers = ['PDL Last Name', 'PDL First Name', 'PDL Middle Name', 'Visitor Name', 'Relationship', 'Age', 'Address', 'Valid ID', 'Date of Application', 'Contact Number'];
    const sample = [
      ['Dela Cruz', 'Juan Denver', 'Dinglasan', 'Alice Johnson', 'Mother', 48, '123 Main St, Sample City', 'ID-AJ-001', '01/10/2025', '555-1001'],
      ['', '', '', 'Bob Williams', 'Brother', 34, '45 Oak Ave, Sample City', 'ID-BW-002', '01/11/2025', '555-1002']
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 16 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PDL+Visitors Template');
    XLSX.writeFile(wb, 'PDL_with_Visitors_Template.xlsx');
  };

  // Import PDLs from uploaded Excel (PDL only)
  const handleImportFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        alert('No rows found in the uploaded file.');
        return;
      }

      let success = 0;
      let failed = 0;
      const errors = [];

      for (const [index, row] of rows.entries()) {
        // Map headers to fields
        const payload = {
          last_name: capitalizeWords(String(row['Last Name'] || '').trim()),
          first_name: capitalizeWords(String(row['First Name'] || '').trim()),
          middle_name: capitalizeWords(String(row['Middle Name'] || '').trim()),
          dorm_number: String(row['Dorm Number'] || '').trim(),
          criminal_case_no: String(row['Criminal Case No.'] || '').trim(),
          offense_charge: String(row['Offense Charge'] || '').trim(),
          court_branch: String(row['Court Branch'] || '').trim(),
          arrest_date: toYMD(row['Date of Arrest']),
          commitment_date: toYMD(row['Date of Commitment']),
          first_time_offender: String(row['First Time Offender'] || 'No').toLowerCase().startsWith('y') ? 1 : 0,
        };

        // Basic validation
        if (!payload.last_name || !payload.first_name || !payload.dorm_number) {
          failed += 1;
          errors.push(`Row ${index + 2}: Missing required fields (Last Name, First Name, Dorm Number)`);
          continue;
        }

        try {
          await axios.post('/pdls', payload);
          success += 1;
        } catch (err) {
          failed += 1;
          errors.push(`Row ${index + 2}: ${err.response?.data?.error || err.message}`);
        }
      }

      await fetchPdls();

      let message = `Import finished. Success: ${success}, Failed: ${failed}.`;
      if (errors.length) {
        message += `\n\nErrors:\n` + errors.slice(0, 10).join('\n');
        if (errors.length > 10) message += `\n...and ${errors.length - 10} more.`;
      }
      alert(message);
    } catch (err) {
      console.error('Failed to import PDLs:', err);
      alert('Failed to import PDLs. Make sure the file follows the template.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Import PDLs with Visitors from uploaded Excel (PDL must already exist, resolved by name)
  const handleImportPdlsWithVisitorsFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) {
        alert('No rows found in the uploaded file.');
        return;
      }

      // Always fetch latest PDLs to avoid stale cache while importing
      const freshPdlsRes = await axios.get('/pdls');
      const freshPdls = freshPdlsRes.data || [];
      // Build a map of existing PDLs by composite key of names (case-insensitive, normalized spaces)
      const nameKey = (ln, fn, mn) => normalizeSpaces(`${(ln || '')}|${(fn || '')}|${(mn || '')}`).toLowerCase();
      const existingByName = new Map();
      freshPdls.forEach(p => existingByName.set(nameKey(p.last_name, p.first_name, p.middle_name || ''), p));

      let visitorCreates = 0;
      const errors = [];
      let lastPdlData = { last_name: '', first_name: '', middle_name: '' };

      for (const [index, row] of rows.entries()) {
        // Get PDL data from separate columns, forward-fill if empty
        const pdlLast = capitalizeWords(normalizeSpaces(row['PDL Last Name']) || lastPdlData.last_name);
        const pdlFirst = capitalizeWords(normalizeSpaces(row['PDL First Name']) || lastPdlData.first_name);
        const pdlMiddle = capitalizeWords(normalizeSpaces(row['PDL Middle Name']) || lastPdlData.middle_name);

        if (!pdlLast || !pdlFirst) {
          errors.push(`Row ${index + 2}: Missing PDL Last Name or First Name.`);
          continue;
        }

        // Update lastPdlData for forward-filling
        lastPdlData = { last_name: pdlLast, first_name: pdlFirst, middle_name: pdlMiddle };

        const key = nameKey(pdlLast, pdlFirst, pdlMiddle);
        let pdl = existingByName.get(key);
        
        // If PDL doesn't exist, create it automatically
        if (!pdl) {
          try {
            const newPdlPayload = {
              last_name: pdlLast,
              first_name: pdlFirst,
              middle_name: pdlMiddle,
              dorm_number: 'TBD', // Default value, user can update later
              criminal_case_no: '',
              offense_charge: '',
              court_branch: '',
              arrest_date: '',
              commitment_date: '',
              first_time_offender: 0
            };
            
            const response = await axios.post('/pdls', newPdlPayload);
            const newPdl = { id: response.data.id, ...newPdlPayload };
            
            // Add to our local map for subsequent rows
            existingByName.set(key, newPdl);
            pdl = newPdl;
            
            console.log(`Auto-created PDL: ${pdlLast}, ${pdlFirst} ${pdlMiddle}`);
          } catch (err) {
            errors.push(`Row ${index + 2}: Failed to auto-create PDL "${pdlLast}, ${pdlFirst} ${pdlMiddle}" - ${err.response?.data?.error || err.message}`);
            continue;
          }
        }

        const visitorName = normalizeSpaces(row['Visitor Name']);
        const relationship = normalizeSpaces(row['Relationship']);
        const ageVal = row['Age'];
        const age = ageVal === '' || ageVal === null || ageVal === undefined ? '' : Number(ageVal);
        const address = normalizeSpaces(row['Address']);
        const valid_id = normalizeSpaces(row['Valid ID']);
        const date_of_application = toYMD(row['Date of Application']);
        const contact_number = normalizeSpaces(row['Contact Number']);

        if (!visitorName || !relationship || Number.isNaN(age) || age === '' || !address || !valid_id || !date_of_application || !contact_number) {
          errors.push(`Row ${index + 2}: Missing/invalid Visitor fields (Name, Relationship, Age, Address, Valid ID, Date of Application, Contact Number)`);
          continue;
        }

        try {
          // Backend mounts visitor routes under /api
          await axios.post(`/api/pdls/${pdl.id}/visitors`, {
            name: visitorName,
            relationship,
            age,
            address,
            valid_id,
            date_of_application,
            contact_number,
            verified_conjugal: false
          });
          visitorCreates += 1;
        } catch (err) {
          errors.push(`Row ${index + 2}: Failed to create visitor - ${err.response?.data?.error || err.message}`);
        }
      }

      // Refresh PDLs after import
      await fetchPdls();

      let message = `Import finished. Visitors created: ${visitorCreates}.`;
      if (errors.length) {
        message += `\n\nErrors:\n` + errors.slice(0, 10).join('\n');
        if (errors.length > 10) message += `\n...and ${errors.length - 10} more.`;
      }
      alert(message);
    } catch (err) {
      console.error('Failed to import PDLs with visitors:', err);
      alert('Failed to import PDLs with visitors. Make sure the file follows the template.');
    } finally {
      if (fileInputVisitorsRef.current) {
        fileInputVisitorsRef.current.value = '';
      }
    }
  };

  // Filter PDLs based on search term and date filters
  const filterPdls = (pdls) => {
    let filtered = pdls;

    // Apply date filter
    if (filterType !== 'all' && filterValue) {
      filtered = filtered.filter(pdl => {
        const arrestDate = pdl.arrest_date ? new Date(pdl.arrest_date) : null;
        const commitmentDate = pdl.commitment_date ? new Date(pdl.commitment_date) : null;
        
        switch (filterType) {
          case 'year':
            const year = parseInt(filterValue);
            return (arrestDate && arrestDate.getFullYear() === year) || 
                   (commitmentDate && commitmentDate.getFullYear() === year);
          case 'month':
            const [yearMonth, month] = filterValue.split('-');
            const yearNum = parseInt(yearMonth);
            const monthNum = parseInt(month);
            return (arrestDate && arrestDate.getFullYear() === yearNum && (arrestDate.getMonth() + 1) === monthNum) ||
                   (commitmentDate && commitmentDate.getFullYear() === yearNum && (commitmentDate.getMonth() + 1) === monthNum);
          case 'day':
            const [yearDay, monthDay, day] = filterValue.split('-');
            const yearDayNum = parseInt(yearDay);
            const monthDayNum = parseInt(monthDay);
            const dayNum = parseInt(day);
            return (arrestDate && arrestDate.getFullYear() === yearDayNum && 
                   (arrestDate.getMonth() + 1) === monthDayNum && arrestDate.getDate() === dayNum) ||
                   (commitmentDate && commitmentDate.getFullYear() === yearDayNum && 
                   (commitmentDate.getMonth() + 1) === monthDayNum && commitmentDate.getDate() === dayNum);
          default:
            return true;
        }
      });
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(pdl => {
        return (
          pdl.last_name.toLowerCase().includes(searchLower) ||
          pdl.first_name.toLowerCase().includes(searchLower) ||
          (pdl.middle_name && pdl.middle_name.toLowerCase().includes(searchLower)) ||
          (pdl.criminal_case_no && pdl.criminal_case_no.toLowerCase().includes(searchLower)) ||
          (pdl.offense_charge && pdl.offense_charge.toLowerCase().includes(searchLower)) ||
          (pdl.court_branch && pdl.court_branch.toLowerCase().includes(searchLower)) ||
          (pdl.dorm_number && pdl.dorm_number.toLowerCase().includes(searchLower))
        );
      });
    }

    return filtered;
  };

  const filteredSortedPdls = filterPdls(pdls)
    .sort((a, b) => {
      // Preserve existing explicit sort options if set
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

      // New header sorting if sortColumn is set
      if (!sortColumn) return 0;
      const aVal = (a[sortColumn] ?? '').toString().toLowerCase();
      const bVal = (b[sortColumn] ?? '').toString().toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredSortedPdls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentPdls = filteredSortedPdls.slice(startIndex, startIndex + itemsPerPage);

  // Update selectAll state when individual checkboxes change
  useEffect(() => {
    if (currentPdls.length === 0) {
      setSelectAll(false);
    } else {
      setSelectAll(selectedPdlIds.length === currentPdls.length);
    }
  }, [selectedPdlIds, currentPdls]);

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
      { wch: 18 }, // First Name
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

// Export PDL with Visitors
const exportPdlsWithVisitorsToExcel = async () => {
  try {
    const response = await axios.get('/api/visitors');
    const visitors = response.data;

    const visitorsByPdl = visitors.reduce((acc, visitor) => {
      const pdlId = visitor.pdl_id;
      if (!acc[pdlId]) acc[pdlId] = [];
      acc[pdlId].push(visitor);
      return acc;
    }, {});

    // Build rows: one row per visitor, include PDL fields once per block by leaving blanks for subsequent rows
    const rows = [];
    const sortedPdls = [...filteredSortedPdls];
    sortedPdls.forEach(pdl => {
      const pdlVisitors = (visitorsByPdl[pdl.id] || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (pdlVisitors.length === 0) {
        rows.push({
          'PDL Last Name': pdl.last_name || '',
          'PDL First Name': pdl.first_name || '',
          'PDL Middle Name': pdl.middle_name || '',
          'Visitor Name': '',
          'Relationship': '',
          'Age': '',
          'Address': '',
          'Valid ID': '',
          'Date of Application': '',
          'Contact Number': ''
        });
      } else {
        pdlVisitors.forEach((v, idx) => {
          rows.push({
            'PDL Last Name': idx === 0 ? (pdl.last_name || '') : '',
            'PDL First Name': idx === 0 ? (pdl.first_name || '') : '',
            'PDL Middle Name': idx === 0 ? (pdl.middle_name || '') : '',
            'Visitor Name': v.name || '',
            'Relationship': v.relationship || '',
            'Age': v.age || '',
            'Address': v.address || '',
            'Valid ID': v.valid_id || '',
            'Date of Application': formatDateOnly(v.date_of_application),
            'Contact Number': v.contact_number || ''
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 30 }, { wch: 16 }, { wch: 18 }, { wch: 16 }
    ];
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[cellAddress]) continue;
      if (!ws[cellAddress].s) ws[cellAddress].s = {};
      ws[cellAddress].s.font = { bold: true };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PDLs with Visitors');
    XLSX.writeFile(wb, 'PDLs_with_Visitors.xlsx');
  } catch (err) {
    console.error('Failed to export PDLs with visitors:', err);
    alert('Failed to export PDLs with visitors');
  }
};

const exportVisitorsToExcelLegacy = exportVisitorsToExcel; // keep reference if needed

  const exportVisitorsToExcelLinkHandler = () => {
    exportPdlsWithVisitorsToExcel();
  };

  const downloadPdlTemplateLinkHandler = () => downloadPdlImportTemplate();
  const downloadPdlWithVisitorsTemplateLinkHandler = () => downloadPdlWithVisitorsTemplate();

  return (
    <div className="common-container">
      <Header activePage="Datas" />

      <main>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px',
            margin: '0 0 16px 0',
            fontSize: '28px',
            fontWeight: '700',
            color: '#111827'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
              <path d="M12 11h4"/>
              <path d="M12 16h4"/>
              <path d="M8 11h.01"/>
              <path d="M8 16h.01"/>
            </svg>
            PDL Visitors Management
          </h2>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button className="common-button add" type="button" onClick={() => setShowAddModal(true)}>
              <svg className="button-icon" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Add a PDL
            </button>
            {selectedPdlIds.length > 0 && (
              <button className="common-button delete" type="button" onClick={handleBulkDelete}>
                <svg className="button-icon" viewBox="0 0 24 24">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
                Delete Selected ({selectedPdlIds.length})
              </button>
            )}
            <button className="common-button export" type="button" onClick={exportToExcel}>
              <svg className="button-icon" viewBox="0 0 24 24">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              Export PDL
            </button>
            <button className="common-button export" type="button" onClick={exportVisitorsToExcelLinkHandler}>
              <svg className="button-icon" viewBox="0 0 24 24">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              Export PDL with Visitors
            </button>
            <button className="common-button" type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()}>
              <svg className="button-icon" viewBox="0 0 24 24">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              Import PDLs
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFileChange} />
            <button className="common-button" type="button" onClick={() => fileInputVisitorsRef.current && fileInputVisitorsRef.current.click()}>
              <svg className="button-icon" viewBox="0 0 24 24">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              </svg>
              Import PDL with Visitors
            </button>
            <input ref={fileInputVisitorsRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportPdlsWithVisitorsFileChange} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', justifyContent: 'center' }}>
          <span role="button" tabIndex={0} onClick={downloadPdlTemplateLinkHandler} onKeyDown={(e) => e.key === 'Enter' && downloadPdlTemplateLinkHandler()} style={{ color: '#4b5563', textDecoration: 'underline', cursor: 'pointer', fontWeight: '500' }}>Download PDL Template</span>
          <span role="button" tabIndex={0} onClick={downloadPdlWithVisitorsTemplateLinkHandler} onKeyDown={(e) => e.key === 'Enter' && downloadPdlWithVisitorsTemplateLinkHandler()} style={{ color: '#4b5563', textDecoration: 'underline', cursor: 'pointer', fontWeight: '500' }}>Download PDL with Visitors Template</span>
        </div>

        <div className="search-filter-container">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '20px',
            width: '100%'
          }}>
            {/* Search Section - Left Column */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'start' }}>
              <label style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                Search:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Search PDLs, names, cases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.outline = 'none';
                    e.target.style.borderColor = '#4b5563';
                    e.target.style.boxShadow = '0 0 0 3px rgba(75, 85, 99, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    transition: 'all 0.2s ease',
                    background: '#fff',
                    width: '250px'
                  }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{
                      padding: '8px',
                      border: 'none',
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    title="Clear search"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Sort Section - Middle Column */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'center' }}>
              <label style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                Sort:
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                aria-label="Sort Options"
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <option value="none">No Sort</option>
                <option value="dorm">Sort by Dorm</option>
                <option value="alphabetical">Sort Alphabetically with Dorm</option>
                <option value="alphabeticalWithDorm">Sort Alphabetically</option>
              </select>
            </div>
            
            {/* Show Only Section - Right Column */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'end' }}>
              <label style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>
                Show Only:
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setFilterValue('');
                }}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <option value="all">All Records</option>
                <option value="year">By Year</option>
                <option value="month">By Month</option>
                <option value="day">By Day</option>
              </select>
              
              {filterType !== 'all' && (
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    background: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '120px'
                  }}
                >
                  <option value="">Select {filterType}...</option>
                  {filterType === 'year' && getUniqueYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                  {filterType === 'month' && getUniqueYears().map(year => 
                    getUniqueMonths(year).map(month => (
                      <option key={`${year}-${month}`} value={`${year}-${month}`}>
                        {new Date(year, month - 1).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </option>
                    ))
                  )}
                  {filterType === 'day' && getUniqueYears().map(year => 
                    getUniqueMonths(year).map(month => 
                      getUniqueDays(year, month).map(day => (
                        <option key={`${year}-${month}-${day}`} value={`${year}-${month}-${day}`}>
                          {new Date(year, month - 1, day).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </option>
                      ))
                    )
                  )}
                </select>
              )}
              
              <div style={{ 
                background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)', 
                color: 'white', 
                padding: '8px 12px', 
                borderRadius: '6px', 
                fontWeight: '600',
                fontSize: '12px'
              }}>
                Showing: {filteredSortedPdls.length} of {pdls.length} records
              </div>
            </div>
          </div>
        </div>
        
        <h3 style={{ textAlign: 'center', margin: '20px 0 16px 0', fontSize: '20px', fontWeight: '600', color: '#111827' }}>PDL Lists</h3>
        
        <table className="common-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAllChange}
                  style={{ marginRight: '8px' }}
                />
              </th>
              <th className="sortable-th" onClick={() => onHeaderClick('last_name')}>Last Name</th>
              <th className="sortable-th" onClick={() => onHeaderClick('first_name')}>First Name</th>
              <th className="sortable-th" onClick={() => onHeaderClick('middle_name')}>Middle Name</th>
              <th className="sortable-th" onClick={() => onHeaderClick('dorm_number')}>Dorm Number</th>
              <th className="sortable-th" onClick={() => onHeaderClick('criminal_case_no')}>Criminal Case No.</th>
              <th className="sortable-th" onClick={() => onHeaderClick('offense_charge')}>Offense Charge</th>
              <th className="sortable-th" onClick={() => onHeaderClick('court_branch')}>Court Branch</th>
              <th className="sortable-th" onClick={() => onHeaderClick('arrest_date')}>Date of Arrest</th>
              <th className="sortable-th" onClick={() => onHeaderClick('commitment_date')}>Date of Commitment</th>
              <th className="sortable-th" onClick={() => onHeaderClick('first_time_offender')}>First Time Offender</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentPdls.map((pdl) => (
              <tr key={pdl.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedPdlIds.includes(pdl.id)}
                    onChange={() => handlePdlCheckboxChange(pdl.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td onClick={() => handlePdlClick(pdl)} style={{ cursor: 'pointer' }}>{pdl.last_name}</td>
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
                    <button className="common-button edit" onClick={() => openEditModal(pdl)} title="Edit PDL">
                      <svg className="button-icon" viewBox="0 0 24 24">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    <button className="common-button delete" onClick={() => handleDelete(pdl.id)} title="Delete PDL">
                      <svg className="button-icon" viewBox="0 0 24 24">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                      </svg>
                    </button>
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
          <div className="common-modal-content wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '24px', fontWeight: '600', color: '#111827' }}>Add a PDL</h3>
            <form onSubmit={handleAddSubmit}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '24px'
              }}>
                {/* Personal Information Section */}
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '20px', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '2px solid #4b5563',
                    paddingBottom: '8px'
                  }}>
                    Personal Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Last Name *</label>
                      <input
                        type="text"
                        placeholder="Enter last name"
                        value={addForm.last_name}
                        onChange={(e) => setAddForm({ ...addForm, last_name: e.target.value })}
                        onBlur={(e) => setAddForm({ ...addForm, last_name: capitalizeWords(e.target.value) })}
                        required
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>First Name *</label>
                      <input
                        type="text"
                        placeholder="Enter first name"
                        value={addForm.first_name}
                        onChange={(e) => setAddForm({ ...addForm, first_name: e.target.value })}
                        onBlur={(e) => setAddForm({ ...addForm, first_name: capitalizeWords(e.target.value) })}
                        required
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Middle Name</label>
                      <input
                        type="text"
                        placeholder="Enter middle name"
                        value={addForm.middle_name}
                        onChange={(e) => setAddForm({ ...addForm, middle_name: e.target.value })}
                        onBlur={(e) => setAddForm({ ...addForm, middle_name: capitalizeWords(e.target.value) })}
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Dorm Number *</label>
                      <input 
                        type="text" 
                        placeholder="Enter dorm number" 
                        value={addForm.dorm_number} 
                        onChange={(e) => setAddForm({ ...addForm, dorm_number: e.target.value })} 
                        required 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Case Information Section */}
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '20px', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '2px solid #4b5563',
                    paddingBottom: '8px'
                  }}>
                    Case Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Criminal Case No.</label>
                      <input 
                        type="text" 
                        placeholder="Enter case number" 
                        value={addForm.criminal_case_no} 
                        onChange={(e) => setAddForm({ ...addForm, criminal_case_no: e.target.value })} 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Offense Charge</label>
                      <input 
                        type="text" 
                        placeholder="Enter offense charge" 
                        value={addForm.offense_charge} 
                        onChange={(e) => setAddForm({ ...addForm, offense_charge: e.target.value })} 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Court Branch</label>
                      <input 
                        type="text" 
                        placeholder="Enter court branch" 
                        value={addForm.court_branch} 
                        onChange={(e) => setAddForm({ ...addForm, court_branch: e.target.value })} 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>First Time Offender</label>
                      <select 
                        value={addForm.first_time_offender} 
                        onChange={(e) => setAddForm({ ...addForm, first_time_offender: e.target.value })}
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: '#fff',
                          cursor: 'pointer',
                          transition: 'border-color 0.2s ease'
                        }}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates Section */}
              <div style={{ 
                background: '#f8fafc', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px'
              }}>
                <h4 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374151',
                  borderBottom: '2px solid #4b5563',
                  paddingBottom: '8px'
                }}>
                  Important Dates
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '20px'
                }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Arrest Date</label>
                    <input
                      type="date"
                      value={addForm.arrest_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setAddForm({ ...addForm, arrest_date: e.target.value })}
                      style={{
                        width: '90%',
                        padding: '10px 12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Commitment Date</label>
                    <input
                      type="date"
                      value={addForm.commitment_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setAddForm({ ...addForm, commitment_date: e.target.value })}
                      style={{
                        width: '90%',
                        padding: '10px 12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="common-modal-buttons" style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '12px',
                marginTop: '24px',
                paddingBottom: '20px'
              }}>
                <button 
                  type="submit"
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
                  Submit
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
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
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="common-modal">
          <div className="common-modal-content wide" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ textAlign: 'center', marginBottom: '24px', fontSize: '24px', fontWeight: '600', color: '#111827' }}>Edit PDL</h3>
            <form onSubmit={handleEditSubmit}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '20px',
                marginBottom: '24px'
              }}>
                {/* Personal Information Section */}
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '20px', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '2px solid #4b5563',
                    paddingBottom: '8px'
                  }}>
                    Personal Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Last Name *</label>
                      <input
                        type="text"
                        placeholder="Enter last name"
                        value={editForm.last_name}
                        onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                        onBlur={(e) => setEditForm({ ...editForm, last_name: capitalizeWords(e.target.value) })}
                        required
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>First Name *</label>
                      <input
                        type="text"
                        placeholder="Enter first name"
                        value={editForm.first_name}
                        onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                        onBlur={(e) => setEditForm({ ...editForm, first_name: capitalizeWords(e.target.value) })}
                        required
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Middle Name</label>
                      <input
                        type="text"
                        placeholder="Enter middle name"
                        value={editForm.middle_name}
                        onChange={(e) => setEditForm({ ...editForm, middle_name: e.target.value })}
                        onBlur={(e) => setEditForm({ ...editForm, middle_name: capitalizeWords(e.target.value) })}
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Dorm Number *</label>
                      <input 
                        type="text" 
                        placeholder="Enter dorm number" 
                        value={editForm.dorm_number} 
                        onChange={(e) => setEditForm({ ...editForm, dorm_number: e.target.value })} 
                        required 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Case Information Section */}
                <div style={{ 
                  background: '#f8fafc', 
                  padding: '20px', 
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <h4 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#374151',
                    borderBottom: '2px solid #4b5563',
                    paddingBottom: '8px'
                  }}>
                    Case Information
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Criminal Case No.</label>
                      <input 
                        type="text" 
                        placeholder="Enter case number" 
                        value={editForm.criminal_case_no} 
                        onChange={(e) => setEditForm({ ...editForm, criminal_case_no: e.target.value })} 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Offense Charge</label>
                      <input 
                        type="text" 
                        placeholder="Enter offense charge" 
                        value={editForm.offense_charge} 
                        onChange={(e) => setEditForm({ ...editForm, offense_charge: e.target.value })} 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Court Branch</label>
                      <input 
                        type="text" 
                        placeholder="Enter court branch" 
                        value={editForm.court_branch} 
                        onChange={(e) => setEditForm({ ...editForm, court_branch: e.target.value })} 
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>First Time Offender</label>
                      <select 
                        value={editForm.first_time_offender} 
                        onChange={(e) => setEditForm({ ...editForm, first_time_offender: e.target.value })}
                        style={{
                          width: '90%',
                          padding: '10px 12px',
                          border: '2px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '14px',
                          background: '#fff',
                          cursor: 'pointer',
                          transition: 'border-color 0.2s ease'
                        }}
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates Section */}
              <div style={{ 
                background: '#f8fafc', 
                padding: '20px', 
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                marginBottom: '24px'
              }}>
                <h4 style={{ 
                  margin: '0 0 20px 0', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  color: '#374151',
                  borderBottom: '2px solid #4b5563',
                  paddingBottom: '8px'
                }}>
                  Important Dates
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '20px'
                }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Arrest Date</label>
                    <input
                      type="date"
                      value={editForm.arrest_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setEditForm({ ...editForm, arrest_date: e.target.value })}
                      style={{
                        width: '90%',
                        padding: '10px 12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#374151' }}>Commitment Date</label>
                    <input
                      type="date"
                      value={editForm.commitment_date}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setEditForm({ ...editForm, commitment_date: e.target.value })}
                      style={{
                        width: '90%',
                        padding: '10px 12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: '#fff',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s ease'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="common-modal-buttons" style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '12px',
                marginTop: '24px',
                paddingBottom: '20px'
              }}>
                <button 
                  type="submit"
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
                  Submit
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export { Datas, exportVisitorsToExcel };
export default Datas;
