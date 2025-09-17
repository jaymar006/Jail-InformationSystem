import React, { useState, useEffect } from 'react';
import Header from './Header';
import api from '../services/api';
import './Dashboard.css';
import './common.css';
import * as XLSX from 'xlsx';

const Logs = () => {
  const [allowedVisitors, setAllowedVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        console.log('Fetching visitors data in Logs.js');
        const allowedRes = await api.get('/api/scanned_visitors');
        setAllowedVisitors(allowedRes.data);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch visitors:', err);
        setError('Failed to fetch visitors data');
        setLoading(false);
      }
    };
    fetchVisitors();

    // Listen for visitorTimesUpdated event to refresh logs
    const handleVisitorTimesUpdated = () => {
      console.log('visitorTimesUpdated event received in Logs.js');
      fetchVisitors();
    };
    window.addEventListener('visitorTimesUpdated', handleVisitorTimesUpdated);

    return () => {
      window.removeEventListener('visitorTimesUpdated', handleVisitorTimesUpdated);
    };
  }, []);

  const formatDateTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const formatTimeOnly = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString();
  };

  // Helper to capitalize the first letter of each word in a string
  const capitalizeWords = (str) => {
    if (!str) return '';
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Sorting handlers
  const onHeaderClick = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const sortedVisitors = [...allowedVisitors].sort((a, b) => {
    if (!sortColumn) return 0;
    const aValRaw = a[sortColumn];
    const bValRaw = b[sortColumn];

    // For time fields, sort by date value
    if (['time_in', 'time_out', 'scan_date'].includes(sortColumn)) {
      const aTime = aValRaw ? new Date(aValRaw).getTime() : 0;
      const bTime = bValRaw ? new Date(bValRaw).getTime() : 0;
      if (aTime < bTime) return sortDirection === 'asc' ? -1 : 1;
      if (aTime > bTime) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    const aVal = (aValRaw ?? '').toString().toLowerCase();
    const bVal = (bValRaw ?? '').toString().toLowerCase();
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Function to handle extraction and download of grouped table data by date as formatted Excel file
  const handleExtractTable = () => {
    if (allowedVisitors.length === 0) {
      alert('No data to extract');
      return;
    }

    // Group visitors by date (date part of time_in)
    const groupedByDate = allowedVisitors.reduce((acc, visitor) => {
      const dateKey = visitor.time_in ? new Date(visitor.time_in).toLocaleDateString() : 'Unknown Date';
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(visitor);
      return acc;
    }, {});

    // Create a new workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws_data = [];

    ws_data.push(["SILANG MUNICIPAL JAIL VISITATION MANAGEMENT SYSTEM"]);
    ws_data.push([]);

    // For each date group, add a date heading row and then the data rows
    Object.keys(groupedByDate).forEach((date) => {
      // Add date heading row (just date string, no "Date:" prefix)
      ws_data.push([date]);
      // Add header row with Contact Number after Visitor's Name and Relationship after PDL's to be Visit Name
      ws_data.push(["Visitor's Name", "Contact Number", "PDL Visited", "Relationship", "Dorm", "Time In", "Time Out"]);

      // Add data rows
      groupedByDate[date].forEach((v) => {
        const timeIn = v.time_in ? new Date(v.time_in).toLocaleTimeString() : '';
        const timeOut = v.time_out ? new Date(v.time_out).toLocaleTimeString() : '';
        ws_data.push([capitalizeWords(v.visitor_name), v.contact_number, capitalizeWords(v.pdl_name), v.relationship, capitalizeWords(v.dorm), timeIn, timeOut]);
      });

      ws_data.push([]);
    });

    // Convert ws_data to worksheet
    const ws = XLSX.utils.aoa_to_sheet(ws_data);

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

    const maxCols = Math.max(...ws_data.map(row => row.length));
    const colWidths = Array.from({ length: maxCols }, (_, colIndex) => {
      let maxLength = 10;
      ws_data.forEach(row => {
        const cell = row[colIndex];
        if (cell) {
          const length = cell.toString().length;
          if (length > maxLength) maxLength = length;
        }
      });
      return { wch: maxLength + 2 };
    });

    ws['!cols'] = colWidths;

    // Set row heights for title, date heading, and header rows
    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 24 }; 

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        if (!ws[cell_ref]) continue;
        if (!ws[cell_ref].s) ws[cell_ref].s = {};
        // Center align all cells
        ws[cell_ref].s.alignment = { vertical: "center", horizontal: "center" };

        // Bold font for title row (row 0)
        if (R === 0) {
          ws[cell_ref].s.font = { bold: true, sz: 14 };
        }
        // Date heading rows (every 5th row starting at 2) - normal font, left aligned, no bold
        else if ((R - 2) % 5 === 0) {
          ws[cell_ref].s.font = { bold: false, sz: 12 };
          ws[cell_ref].s.alignment = { vertical: "center", horizontal: "left" };
          ws['!rows'][R] = { hpt: 20 };
        }
        // Bold font for header rows (every 5th row starting at 3)
        else if ((R - 3) % 5 === 0) {
          if (!ws[cell_ref].s.font) ws[cell_ref].s.font = {};
          ws[cell_ref].s.font.bold = true;
          ws[cell_ref].s.font.sz = 12;
          ws[cell_ref].s.border = {
            bottom: { style: "thin", color: { rgb: "000000" } }
          };
          ws['!rows'][R] = { hpt: 18 };
        }
      }
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Visitor Logs');

    XLSX.writeFile(wb, 'visitor_logs_by_date.xlsx');
  };

  if (loading) {
    return (
      <>
        <Header activePage="Logs" />
        <div className="common-container">
          <main>
            <h2>Visitor Logs</h2>

          <div className="action-buttons">
            <button
              onClick={handleExtractTable}
              className="common-button"
              aria-label="Extract table grouped by date"
              style={{ marginRight: '10px' }}
            >
              Export To Excel
            </button>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                api.get('/api/scanned_visitors')
                  .then(res => {
                    setAllowedVisitors(res.data);
                    setLoading(false);
                  })
                  .catch(err => {
                    console.error('Failed to fetch visitors:', err);
                    setError('Failed to fetch visitors data');
                    setLoading(false);
                  });
              }}
              className="common-button"
              aria-label="Refresh visitor logs"
            >
              Refresh
            </button>
          </div>
          </main>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header activePage="Logs" />
        <div className="common-container p-4 error-message">{error}</div>
      </>
    );
  }

  return (
    <>
      <Header activePage="Logs" />
      <div className="common-container">
        <main>
          <section className="p-4">
            <h2>Visitor Logs</h2>

            <div className="action-buttons">
              <button
                onClick={handleExtractTable}
                className="common-button"
                aria-label="Extract table grouped by date"
              >
                Export To Excel
              </button>
            </div>
          </section>

          <h3 style={{ textAlign: 'center' }}>Allowed Visitors</h3>
          <table className="common-table">
            <thead>
            <tr>
              <th className="sortable-th" onClick={() => onHeaderClick('visitor_name')}>Visitor's Name</th>
              <th className="sortable-th" onClick={() => onHeaderClick('contact_number')}>Contact Number</th>
              <th className="sortable-th" onClick={() => onHeaderClick('pdl_name')}>PDL Visited</th>
              <th className="sortable-th" onClick={() => onHeaderClick('relationship')}>Relationship</th>
              <th className="sortable-th" onClick={() => onHeaderClick('dorm')}>Dorm</th>
              <th className="sortable-th" onClick={() => onHeaderClick('time_in')}>Time In</th>
              <th className="sortable-th" onClick={() => onHeaderClick('time_out')}>Time Out</th>
              <th className="sortable-th" onClick={() => onHeaderClick('time_in')}>Date</th>
            </tr>
          </thead>
          <tbody>
            {sortedVisitors.length === 0 ? (
              <tr>
                <td colSpan="8">No records</td>
              </tr>
            ) : (
              sortedVisitors.map((v) => (
                <tr key={v.id}>
                  <td>{capitalizeWords(v.visitor_name)}</td>
                  <td>{v.contact_number}</td>
                  <td>{capitalizeWords(v.pdl_name)}</td>
                  <td>{v.relationship}</td>
                  <td>{capitalizeWords(v.dorm)}</td>
                  <td>{v.time_in ? formatTimeOnly(v.time_in) : ''}</td>
                  <td>{v.time_out ? formatTimeOnly(v.time_out) : ''}</td>
                  <td>{v.time_in ? formatDateTime(v.time_in).split(',')[0] : ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </main>
      </div>
    </>
  );
};

export default Logs;
