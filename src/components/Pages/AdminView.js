import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { collection, query, orderBy, onSnapshot, where, getDocs, updateDoc, doc } from "firebase/firestore";
import "../Styles/ExcelTable.css";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AdminView Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          width: '100%', 
          maxWidth: 1200, 
          margin: '70px auto 0 auto', 
          textAlign: 'center', 
          padding: '2rem' 
        }}>
          <div style={{ fontSize: '1.2em', color: '#d32f2f', marginBottom: '1rem' }}>
            Something went wrong loading the samples.
          </div>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              padding: '0.5rem 1rem',
              background: '#1c6954',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '1rem'
            }}
          >
            Reload Page
          </button>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            style={{
              padding: '0.5rem 1rem',
              background: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function SamplesTable({ driverName, driverId }) {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvedDriverId, setResolvedDriverId] = useState(driverId);
  const [expandedBarcodes, setExpandedBarcodes] = useState(new Set());
  const [activeBarcode, setActiveBarcode] = useState(null);

  // Function to find driver ID by name
  const findDriverIdByName = async (name) => {
    try {
      const driverCol = collection(db, 'driver');
      const q = query(driverCol, where('name', '==', name));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const driverDoc = querySnapshot.docs[0];
        return driverDoc.data().userId || driverDoc.id;
      }
      return null;
    } catch (err) {
      console.error("Error finding driver ID by name:", err);
      return null;
    }
  };

  useEffect(() => {
    let samplesUnsubscribe = null;
    let isActive = true;

    const setupListeners = async () => {
      try {
        setLoading(true);
        setError(null);

        // Add a small delay to prevent rapid listener setup
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!isActive) return;

        // If we don't have a driverId but have a driverName, try to find the driverId
        let effectiveDriverId = driverId;
        if ((!driverId || driverId === "" || driverId === "Unknown") && driverName && driverName !== "Driver") {
          console.log("Attempting to find driver ID for name:", driverName);
          const foundDriverId = await findDriverIdByName(driverName);
          if (foundDriverId) {
            effectiveDriverId = foundDriverId;
            setResolvedDriverId(foundDriverId);
            console.log("Found driver ID:", foundDriverId, "for name:", driverName);
          } else {
            console.log("Could not find driver ID for name:", driverName);
          }
        } else {
          setResolvedDriverId(driverId);
        }

        if (!isActive) return;

        // Setup samples listener with better error handling
        let q;
        try {
          if (effectiveDriverId && effectiveDriverId !== "Unknown" && effectiveDriverId.trim() !== "") {
            console.log("Filtering samples for driverId:", effectiveDriverId);
            // Filter by current driver's ID
            q = query(
              collection(db, "samples"), 
              where("driver", "==", effectiveDriverId),
              orderBy("date", "desc")
            );
          } else {
            console.log("Loading all samples (no driverId filter)");
            // Fallback to all samples if no driver ID
            q = query(collection(db, "samples"), orderBy("date", "desc"));
          }
        } catch (queryError) {
          console.error("Error creating query:", queryError);
          // Fallback to simple query without filters but maintain sort order
          q = query(collection(db, "samples"), orderBy("date", "desc"));
        }

        let retryCount = 0;
        const maxRetries = 2;

        const setupSamplesListener = (queryToUse) => {
          if (samplesUnsubscribe) {
            try {
              samplesUnsubscribe();
            } catch (err) {
              console.error("Error unsubscribing from previous listener:", err);
            }
          }

          samplesUnsubscribe = onSnapshot(
            queryToUse, 
            (snap) => {
              if (!isActive) return;
              try {
                console.log("Samples snapshot received, docs count:", snap.docs.length);
                const sampleData = snap.docs.map(doc => ({
                  id: doc.id,
                  _docId: doc.id,  // Document ID for reference
                  ...doc.data()
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
                
                // If we have a driverId, filter the results client-side as fallback
                if (effectiveDriverId && effectiveDriverId !== "Unknown" && effectiveDriverId.trim() !== "") {
                  const filteredData = sampleData.filter(sample => sample.driver === effectiveDriverId);
                  console.log("Client-side filtered samples count:", filteredData.length);
                  
                  const groupedData = groupSamplesByBarcode(filteredData);
                  // Sort by latest date in descending order (most recent first)
                  const sortedData = groupedData.sort((a, b) => {
                    const dateA = a.latestDate;
                    const dateB = b.latestDate;
                    return dateB - dateA;
                  });
                  setSamples(sortedData);
                } else {
                  const groupedData = groupSamplesByBarcode(sampleData);
                  // Sort by latest date in descending order (most recent first)
                  const sortedData = groupedData.sort((a, b) => {
                    const dateA = a.latestDate;
                    const dateB = b.latestDate;
                    return dateB - dateA;
                  });
                  setSamples(sortedData);
                }
                
                setLoading(false);
              } catch (err) {
                console.error("Error processing sample data:", err);
                setError("Error loading sample data");
                setLoading(false);
              }
            },
            (error) => {
              if (!isActive) return;
              console.error("Samples listener error:", error);
              
              // Check if it's an index error and we can retry with simpler query
              if ((error.code === 'failed-precondition' || error.code === 'unimplemented') && retryCount < maxRetries) {
                console.log("Index error, retrying with simpler query...");
                retryCount++;
                // Try with simpler query but still maintain orderBy
                const fallbackQuery = query(collection(db, "samples"), orderBy("date", "desc"));
                setupSamplesListener(fallbackQuery);
                return;
              }
              
              // Check if it's an index error
              if (error.code === 'failed-precondition' || error.code === 'unimplemented') {
                setError("Database index not ready. Please try again in a moment.");
              } else {
                setError("Error loading sample data");
              }
              setLoading(false);
            }
          );
        };

        setupSamplesListener(q);

      } catch (err) {
        if (!isActive) return;
        console.error("Error setting up listeners:", err);
        setError("Error setting up data listeners");
        setLoading(false);
      }
    };

    setupListeners();

    // Cleanup function
    return () => {
      isActive = false;
      if (samplesUnsubscribe) {
        try {
          samplesUnsubscribe();
        } catch (err) {
          console.error("Error unsubscribing from samples listener:", err);
        }
      }
    };
  }, [driverId, driverName]);
  
  if (loading) {
    return (
      <div style={{ width: '100%', maxWidth: '100%', margin: '70px auto 0 auto', textAlign: 'center', padding: '2rem 0' }}>
        <div style={{ fontSize: '1.2em', color: '#666' }}>Loading samples...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ width: '100%', maxWidth: '100%', margin: '70px auto 0 auto', textAlign: 'center', padding: '2rem 0' }}>
        <div style={{ fontSize: '1.2em', color: '#d32f2f', marginBottom: '1rem' }}>Error: {error}</div>
        <div style={{ fontSize: '0.9em', color: '#666', marginBottom: '1rem' }}>
          Driver ID: {driverId || 'Not provided'}
        </div>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#1c6954',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '0.5rem'
          }}
        >
          Reload Page
        </button>
        <button 
          onClick={() => setError(null)} 
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Approve arrival for all samples in a barcode group (same as Samples page)
  const handleApprove = async (group) => {
    try {
      const updatePromises = group.samples.map(sample => {
        if (sample._docId) {
          const sampleRef = doc(db, "samples", sample._docId);
          return updateDoc(sampleRef, { arrivedDate: new Date() });
        }
        return Promise.resolve();
      });
      await Promise.all(updatePromises);
      alert(`All ${group.samples.length} samples for barcode ${group.barcode} have been approved!`);
    } catch (err) {
      console.error("Error approving samples:", err);
      alert("Error approving samples. Please try again.");
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '100%', margin: '40px auto 0 auto', padding: '0' }}>
      <div className="table-container" style={{ margin: '0', padding: '0' }}>
        <h2 className="page-title">Samples collected by {driverName}</h2>
        <div className="table-wrapper" style={{ margin: '0', padding: '0' }}>
          <table className="excel-table" style={{ width: '100%' }}>
          <thead>
            <tr>
                <th>SID</th>
                <th>Sample Type</th>
                <th>Location</th>
                <th>Scanned Date</th>
                <th>Arrived Date</th>
                <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {samples.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '1.5em', color: '#888', textAlign: 'center' }}>No samples found for this driver.</td></tr>
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
                        </button>
                      )}
                    </td>
                    <td>{group.location || '-'}</td>
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
                        </div>
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expandable sub-samples */}
                  {activeBarcode === group.barcode && group.samples.length > 1 && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0, border: 'none' }}>
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
                                          return <span className="status-approved">{formatted}</span>;
                                        })()}
                                      </span>
                                    ) : (
                                      <span className="status-not-arrived">Not Arrived</span>
                                    )}
                                  </td>
                                  <td>
                                    <button
                                      onClick={() => {
                                        if (!sample.arrivedDate?.toDate && sample._docId) {
                                          const sampleRef = doc(db, "samples", sample._docId);
                                          updateDoc(sampleRef, { arrivedDate: new Date() });
                                        }
                                      }}
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
    </div>
  );
}

const AdminView = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const driverName = location.state?.driverName || "Driver";
  const driverId = location.state?.driverId || "";

  // Debug logging
  console.log("AdminView - driverName:", driverName);
  console.log("AdminView - driverId:", driverId);
  console.log("AdminView - location.state:", location.state);

  return (
    <ErrorBoundary>
      <button
        onClick={() => navigate(-1)}
        className="back-button"
      >
        <span>&larr;</span> <span>Back</span>
      </button>
      <SamplesTable driverName={driverName} driverId={driverId} />
    </ErrorBoundary>
  );
};

export default AdminView;
