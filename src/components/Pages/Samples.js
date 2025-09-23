import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, orderBy, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../Styles/ExcelTable.css";

const Samples = () => {
  const [samples, setSamples] = useState([]);
  const [driverMap, setDriverMap] = useState({}); // userId -> name
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedBarcodes, setExpandedBarcodes] = useState(new Set());
  const [activeBarcode, setActiveBarcode] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const navigate = useNavigate();



  // Fetch all drivers for name lookup
  useEffect(() => {
    let driverUnsubscribe = null;
    
    try {
      driverUnsubscribe = onSnapshot(
        collection(db, 'driver'), 
        (snap) => {
          try {
            const map = {};
            snap.docs.forEach(doc => {
              const d = doc.data();
              if (d.userId && d.name) {
                map[d.userId] = d.name;  // userId (DID-xxxx) -> name mapping
              }
            });
            setDriverMap(map);
          } catch (err) {
            console.error("Error processing driver data:", err);
            setError("Error loading driver data");
          }
        },
        (error) => {
          console.error("Driver listener error:", error);
          setError("Error loading driver data");
        }
      );
    } catch (err) {
      console.error("Error setting up driver listener:", err);
      setError("Error setting up driver listener");
    }

    return () => {
      if (driverUnsubscribe) {
        try {
          driverUnsubscribe();
        } catch (err) {
          console.error("Error unsubscribing from driver listener:", err);
        }
      }
    };
  }, []);

  // Fetch all samples
  useEffect(() => {
    let samplesUnsubscribe = null;
    
    try {
    const q = query(collection(db, "samples"), orderBy("date", "desc"));
      samplesUnsubscribe = onSnapshot(
        q, 
        (snap) => {
          try {
            const sampleData = snap.docs.map(doc => ({ 
              ...doc.data(), 
              _docId: doc.id  // Document ID for reference
            }));
            
            // Group samples by barcode
            const groupSamplesByBarcode = (samples) => {
              const grouped = {};
              
              samples.forEach(sample => {
                // Use baseBarcode for grouping (new structure) or fallback to old logic
                const barcode = sample.baseBarcode || sample.barcode || sample.SID?.split('_')[0] || sample.SID;
                if (!grouped[barcode]) {
                  grouped[barcode] = {
                    barcode: barcode,
                    samples: [],
                    latestDate: null,
                    latestDriver: null,
                    latestDriverName: null,
                    location: null,
                    allApproved: true
                  };
                }
                
                grouped[barcode].samples.push(sample);
                
                // Track latest date
                const sampleDate = sample.date?.toDate ? sample.date.toDate() : new Date(sample.date);
                if (!grouped[barcode].latestDate || sampleDate > grouped[barcode].latestDate) {
                  grouped[barcode].latestDate = sampleDate;
                  grouped[barcode].latestDriver = sample.driver;
                  grouped[barcode].latestDriverName = sample.driverName;
                }
                
                // Track location (use first non-null location)
                if (!grouped[barcode].location && sample.location) {
                  grouped[barcode].location = sample.location;
                }
                
                // Check if all samples are approved
                if (!sample.arrivedDate) {
                  grouped[barcode].allApproved = false;
                }
              });
              
              return Object.values(grouped);
            };
            
            const groupedData = groupSamplesByBarcode(sampleData);
            // Sort by latest date in descending order (most recent first)
            const sortedData = groupedData.sort((a, b) => {
              const dateA = a.latestDate;
              const dateB = b.latestDate;
              return dateB - dateA;
            });
            
            setSamples(sortedData);
            setLoading(false);
          } catch (err) {
            console.error("Error processing sample data:", err);
            setError("Error loading sample data");
            setLoading(false);
          }
        },
        (error) => {
          console.error("Samples listener error:", error);
          setError("Error loading sample data");
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("Error setting up samples listener:", err);
      setError("Error setting up samples listener");
      setLoading(false);
    }

    return () => {
      if (samplesUnsubscribe) {
        try {
          samplesUnsubscribe();
        } catch (err) {
          console.error("Error unsubscribing from samples listener:", err);
        }
      }
    };
  }, []);

  // Show notification
  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'success' });
    }, 3000);
  };

  // Approve arrival for all samples in a barcode group
  const handleApprove = async (group) => {
    try {
      // Approve all samples in the group
      const updatePromises = group.samples.map(sample => {
        if (sample._docId) {
          const sampleRef = doc(db, "samples", sample._docId);
          return updateDoc(sampleRef, { arrivedDate: new Date() });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      showNotification(`All ${group.samples.length} samples for barcode ${group.barcode} have been approved!`);
    } catch (error) {
      console.error("Error approving samples:", error);
      showNotification("Error approving samples. Please try again.", 'error');
    }
  };

  // Approve individual sample
  const handleApproveSample = async (sample, barcode) => {
    try {
      if (sample._docId) {
        const sampleRef = doc(db, "samples", sample._docId);
        await updateDoc(sampleRef, { arrivedDate: new Date() });
        showNotification(`Sample ${sample.SID} for barcode ${barcode} has been approved!`);
      }
    } catch (error) {
      console.error("Error approving sample:", error);
      showNotification("Error approving sample. Please try again.", 'error');
    }
  };



  if (loading) {
    return (
      <div style={{ width: '100%', maxWidth: 1200, margin: '40px auto 0 auto', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '1.2em', color: '#666' }}>Loading samples...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', maxWidth: 1200, margin: '40px auto 0 auto', textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '1.2em', color: '#d32f2f' }}>Error: {error}</div>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#1c6954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '40px auto 0 auto', padding: '0' }}>
      {/* Notification Toast */}
      {notification.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: notification.type === 'success' ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          fontSize: '14px',
          fontWeight: '500',
          maxWidth: '400px',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          {notification.message}
        </div>
      )}
      <button
        onClick={() => navigate(-1)}
        className="back-button"
      >
        <span>&larr;</span> <span>Back</span>
      </button>
      <div className="table-container" style={{ margin: '0', padding: '0' }}>
        <h2 className="page-title">All Samples</h2>
        <div className="table-wrapper" style={{ margin: '0', padding: '0' }}>
          <table className="excel-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>SID</th>
            <th>Sample Type</th>
            <th>Location</th>
            <th>Driver ID</th>
            <th>Driver Name</th>
            <th>Scanned Date</th>
            <th>Arrived Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {samples.length === 0 ? (
            <tr><td colSpan={8} style={{ padding: '1.5em', color: '#888', textAlign: 'center' }}>No samples found.</td></tr>
          ) : (
            samples.map((group, idx) => (
              <React.Fragment key={group.barcode || idx}>
                <tr>
                <td>{group.barcode ? `SID-${group.barcode}` : '-'}</td>
                <td>
                    {group.samples.length === 1 ? (
                      // Display sample type directly for single samples
                      <span>
                        {group.samples[0].sampleType || '-'}
                      </span>
                    ) : (
                      // Show button for multiple samples
                  <button
                    onClick={() => {
                      if (activeBarcode === group.barcode) {
                        // If clicking the same barcode, close it
                        setActiveBarcode(null);
                        setExpandedBarcodes(new Set());
                          } else {
                        // If clicking a different barcode, close previous and open new one
                        setActiveBarcode(group.barcode);
                        setExpandedBarcodes(new Set([group.barcode]));
                      }
                    }}
                    className="btn"
                    title={group.samples.map(sample => sample.sampleType || 'Unknown').filter((type, index, arr) => arr.indexOf(type) === index).join(', ')}
                  >
                    <span>
                      {activeBarcode === group.barcode ? 'Hide Samples' : `${group.samples.length} Samples`}
                    </span>
                    <div className="ripple-container">
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </button>
                    )}
                </td>
                <td>{group.location || '-'}</td>
                <td>{group.latestDriver || '-'}</td>
                <td>{group.latestDriverName || driverMap[group.latestDriver] || '-'}</td>
                <td>{group.latestDate ? group.latestDate.toLocaleString() : '-'}</td>
                <td>
                  {group.allApproved ? (
                      <span className="status-approved">
                        {group.samples[0]?.arrivedDate?.toDate ? 
                          (group.samples.length === 1 ? 
                            // Full timestamp for single samples with custom formatting
                            (() => {
                              const date = group.samples[0].arrivedDate.toDate();
                              const formatted = date.toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                              });
                              // Split the string to style 'at' and 'AM'/'PM' in black
                              const parts = formatted.split(' at ');
                              if (parts.length === 2) {
                                const timeParts = parts[1].split(' ');
                                const time = timeParts[0];
                                const ampm = timeParts[1];
                                return (
                                  <>
                                    <span className="status-approved">{parts[0]}</span>
                                    <span style={{ color: '#000000' }}> at </span>
                                    <span className="status-approved">{time}</span>
                                    <span style={{ color: '#000000' }}> {ampm}</span>
                                  </>
                                );
                              }
                              return <span className="status-approved">{formatted}</span>;
                            })() :
                            // Date only for multiple samples
                            group.samples[0].arrivedDate.toDate().toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })
                          ) : 
                          'Approved'
                        }
                      </span>
                  ) : (
                      <span className="status-not-arrived">Not Arrived</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => !group.allApproved && handleApprove(group)}
                      className={group.allApproved ? "btn-approve-all disabled" : "btn-approve-all"}
                      disabled={group.allApproved}
                    >
                      <span>{group.allApproved ? 'Approved' : 'Approve all'}</span>
                      <div className="ripple-container">
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </button>
                  </td>
                </tr>
                
                {/* Expandable sub-samples */}
                {activeBarcode === group.barcode && group.samples.length > 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                      <div className="expanded-row">
                        <table className="expanded-table" style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th>SID</th>
                              <th>Sample Type</th>
                              <th>Scanned Date</th>
                              <th>Arrived Date</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.samples.sort((a, b) => {
                              // Use subSampleNumber for sorting (new structure) or fallback to old logic
                              const aNum = a.subSampleNumber || parseInt(a.SID?.split('_').pop() || '0');
                              const bNum = b.subSampleNumber || parseInt(b.SID?.split('_').pop() || '0');
                              return aNum - bNum; // Sort in ascending order
                            }).map((sample, sampleIdx) => (
                              <tr key={sample._docId || sampleIdx}>
                                <td>{sample.SID || '-'}</td>
                                <td>{sample.sampleType || '-'}</td>
                                <td>
                                  {sample.date?.toDate ? sample.date.toDate().toLocaleString() : '-'}
                                </td>
                                <td>
                                  {sample.arrivedDate?.toDate ? (
                                    <span className="status-approved">
                                      {(() => {
                                        const date = sample.arrivedDate.toDate();
                                        const formatted = date.toLocaleString('en-US', {
                                          year: 'numeric',
                                          month: 'long',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                          hour12: true
                                        });
                                        // Split the string to style 'at' and 'AM'/'PM' in black
                                        const parts = formatted.split(' at ');
                                        if (parts.length === 2) {
                                          const timeParts = parts[1].split(' ');
                                          const time = timeParts[0];
                                          const ampm = timeParts[1];
                                          return (
                                            <>
                                              <span className="status-approved">{parts[0]}</span>
                                              <span style={{ color: '#000000' }}> at </span>
                                              <span className="status-approved">{time}</span>
                                              <span style={{ color: '#000000' }}> {ampm}</span>
                                            </>
                                          );
                                        }
                                        return <span className="status-approved">{formatted}</span>;
                                      })()}
                                    </span>
                                  ) : (
                                    <span className="status-not-arrived">Not Arrived</span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    onClick={() => !sample.arrivedDate?.toDate && handleApproveSample(sample, group.barcode)}
                                    className={sample.arrivedDate?.toDate ? "btn disabled" : "btn"}
                                    disabled={sample.arrivedDate?.toDate}
                                  >
                                    <span>{sample.arrivedDate?.toDate ? 'Approved' : 'Approve'}</span>
                                    <div className="ripple-container">
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                      <span></span>
                                    </div>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
      </div>
        <div className="table-footer">
          <span>Total Barcodes: {samples.length}</span>
        </div>
      </div>
      {/* CSS Animation for notification */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Samples;
