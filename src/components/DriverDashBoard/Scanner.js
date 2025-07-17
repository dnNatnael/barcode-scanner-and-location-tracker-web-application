


import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { getDoc, doc, collection, addDoc, serverTimestamp, runTransaction, query, orderBy, onSnapshot } from "firebase/firestore";

const CAMERA_WIDTH = 480;
const CAMERA_HEIGHT = 360;
const MIN_FRAME_WIDTH = 120;
const MIN_FRAME_HEIGHT = 80;
const MAX_FRAME_WIDTH = CAMERA_WIDTH - 20;
const MAX_FRAME_HEIGHT = CAMERA_HEIGHT - 20;

const Scanner = () => {
  // User info logic
  const location = useLocation();
  const navigate = useNavigate();
  const name = location.state?.name || "User";
  const [userId, setUserId] = useState("");
  const [driverName, setDriverName] = useState(name);
  const stopCameraRef = useRef(null);

  useEffect(() => {
    const fetchUserId = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          setUserId(userDoc.data().userId || "");
          setDriverName(userDoc.data().name || name);
        }
      }
    };
    fetchUserId();
  }, []);

  return (
    <div style={{ minHeight: '10vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      {/* User greeting and ID above the scanner */}
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Driver Dashboard: Scanner</h1>
      <p>Welcome {name}!</p>
      {userId && <p>Your ID: {userId}</p>}
      </div>
      <div className="bg-white p-4 rounded shadow flex flex-col items-center">
        <h2 className="text-lg font-semibold mb-2" style={{ marginBottom: 16 }}>📷 Barcode Scanner</h2>
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <ScannerCamera setStopCamera={fn => (stopCameraRef.current = fn)} />
        </div>
        <button
          style={{ marginTop: 32, padding: '12px 28px', background: '#1c6954', color: 'white', border: 'none', borderRadius: 8, fontSize: 18, fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
          onClick={() => {
            if (stopCameraRef.current) stopCameraRef.current();
            navigate('/driver-sample-scan', { state: { driverName } });
          }}
        >
          Sample collected
        </button>
      </div>
    </div>
  );
};

const ScannerCamera = ({ setStopCamera }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [frame, setFrame] = useState({
    width: 240,
    height: 160,
    top: (CAMERA_HEIGHT - 160) / 2,
    left: (CAMERA_WIDTH - 240) / 2,
  });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, width: 0, height: 0, midX: 0, midY: 0 });
  const [facingMode, setFacingMode] = useState("environment"); // "user" for selfie, "environment" for back

  // Start camera
  useEffect(() => {
    let stream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: CAMERA_WIDTH,
            height: CAMERA_HEIGHT,
            facingMode: { exact: facingMode }
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        // handle error
      }
    })();

    // Register stop function
    if (setStopCamera) {
      setStopCamera(() => () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [setStopCamera, facingMode]);

  // Drag/resize logic (midpoint reference)
  const onMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: frame.width,
      height: frame.height,
      midX: frame.left + frame.width / 2,
      midY: frame.top + frame.height / 2,
    };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    let newWidth = Math.max(MIN_FRAME_WIDTH, Math.min(MAX_FRAME_WIDTH, dragStart.current.width + dx));
    let newHeight = Math.max(MIN_FRAME_HEIGHT, Math.min(MAX_FRAME_HEIGHT, dragStart.current.height + dy));
    // Calculate new top/left so midpoint stays fixed
    let newLeft = dragStart.current.midX - newWidth / 2;
    let newTop = dragStart.current.midY - newHeight / 2;
    // Restrict so frame stays within camera
    if (newLeft < 0) {
      newLeft = 0;
      newWidth = dragStart.current.midX * 2;
    }
    if (newTop < 0) {
      newTop = 0;
      newHeight = dragStart.current.midY * 2;
    }
    if (newLeft + newWidth > CAMERA_WIDTH) {
      newWidth = CAMERA_WIDTH - newLeft;
    }
    if (newTop + newHeight > CAMERA_HEIGHT) {
      newHeight = CAMERA_HEIGHT - newTop;
    }
    setFrame({ width: newWidth, height: newHeight, left: newLeft, top: newTop });
  };
  const onMouseUp = () => {
    setDragging(false);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  return (
    <div style={{ position: 'relative', width: CAMERA_WIDTH, height: CAMERA_HEIGHT, background: '#000', border: '4px solid #222', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {/* Dimming overlays */}
      {/* Top overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: frame.top,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />
      {/* Left overlay */}
      <div style={{
        position: 'absolute',
        top: frame.top,
        left: 0,
        width: frame.left,
        height: frame.height,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />
      {/* Right overlay */}
      <div style={{
        position: 'absolute',
        top: frame.top,
        left: frame.left + frame.width,
        width: CAMERA_WIDTH - (frame.left + frame.width),
        height: frame.height,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />
      {/* Bottom overlay */}
      <div style={{
        position: 'absolute',
        top: frame.top + frame.height,
        left: 0,
        width: '100%',
        height: CAMERA_HEIGHT - (frame.top + frame.height),
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1,
        pointerEvents: 'none',
      }} />
      {/* Scanner frame overlay */}
      <div
        style={{
          position: 'absolute',
          top: frame.top,
          left: frame.left,
          width: frame.width,
          height: frame.height,
          // No border, use corners instead
          borderRadius: 8,
          boxSizing: 'border-box',
          zIndex: 2,
          background: dragging ? 'rgba(255, 214, 0, 0.18)' : 'rgba(0,0,0,0.0)',
          pointerEvents: 'none',
        }}
      >
        {/* Scan window corners */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: 28, height: 28,
          borderTop: '4px solid #FFD600',
          borderLeft: '4px solid #FFD600',
          borderTopLeftRadius: 8,
          boxSizing: 'border-box',
          zIndex: 3,
        }} />
        <div style={{
          position: 'absolute',
          top: 0, right: 0,
          width: 28, height: 28,
          borderTop: '4px solid #FFD600',
          borderRight: '4px solid #FFD600',
          borderTopRightRadius: 8,
          boxSizing: 'border-box',
          zIndex: 3,
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0,
          width: 28, height: 28,
          borderBottom: '4px solid #FFD600',
          borderLeft: '4px solid #FFD600',
          borderBottomLeftRadius: 8,
          boxSizing: 'border-box',
          zIndex: 3,
        }} />
        <div style={{
          position: 'absolute',
          bottom: 0, right: 0,
          width: 28, height: 28,
          borderBottom: '4px solid #FFD600',
          borderRight: '4px solid #FFD600',
          borderBottomRightRadius: 8,
          boxSizing: 'border-box',
          zIndex: 3,
        }} />
        {/* Green scanning line */}
        <div style={{
          position: 'absolute',
          left: 0,
          width: '100%',
          height: 4,
          background: 'linear-gradient(90deg, rgba(0,255,0,0.7) 0%, rgba(0,255,0,1) 50%, rgba(0,255,0,0.7) 100%)',
          boxShadow: '0 0 8px 2px #0f0',
          zIndex: 3,
          animation: 'scan-move 2.5s linear infinite',
        }} />
        <style>{`
          @keyframes scan-move {
            0% { top: 0; }
            100% { top: 100%; }
          }
        `}</style>
        {/* Resize handle (⤡ icon) inside the frame, bottom-right with margin */}
        <div
          style={{
            position: 'absolute',
            right: 6,
            bottom: 6,
            width: 28,
            height: 28,
            background: 'none',
            border: 'none',
            borderRadius: 0,
            cursor: 'nwse-resize',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            fontSize: 22,
            fontWeight: 'bold',
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)'
          }}
          onMouseDown={onMouseDown}
          aria-label="Resize scanner frame"
          role="button"
          tabIndex={0}
        >
          <span style={{ fontWeight: 'bold', color: '#FFD600', fontSize: 22, userSelect: 'none' }}>⤡</span>
        </div>
      </div>
      <button
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
        onClick={() => setFacingMode(facingMode === "environment" ? "user" : "environment")}
      >
        Switch Camera
      </button>
    </div>
  );
};

function SamplesTable({ driverName }) {
  const [samples, setSamples] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "d_sample"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSamples(snap.docs.map(doc => doc.data()));
    });
    return unsub;
  }, []);
  return (
    <div style={{ width: '100%', maxWidth: 1050, margin: '0 auto' }}>
      <h2 style={{ margin: '1.5em 0 0.5em 0', textAlign: 'left' }}>Sample collected by {driverName}</h2>
      <table className="it-users-table">
        <thead>
          <tr>
            <th style={{ width: '25%', fontSize: '1.35em' }}>ID</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Barcode</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Location</th>
            <th style={{ width: '25%', fontSize: '1.35em' }}>Date and Time</th>
          </tr>
        </thead>
        <tbody>
          {samples.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.barcode}</td>
              <td>{s.location}</td>
              <td>{s.date?.toDate ? s.date.toDate().toLocaleString() : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: '0.9em', marginTop: '0.3em', color: '#555' }}>
        Total Samples: {samples.length}
      </div>
    </div>
  );
}

// Helper to get next SID-xxxx
async function getNextSampleId() {
  const counterRef = doc(db, "d_sample_counter", "last");
  return await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let lastId = 0;
    if (counterDoc.exists()) {
      lastId = counterDoc.data().lastId || 0;
    }
    const nextId = lastId + 1;
    transaction.set(counterRef, { lastId: nextId });
    return `SID-${String(nextId).padStart(4, '0')}`;
  });
}

// Helper to get driver name
async function getDriverName(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    return userDoc.data().name || "Unknown";
  }
  return "Unknown";
}

// Save scan
async function saveSampleScan(barcode, location) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not logged in");
  const driverName = await getDriverName(user.uid);
  const id = await getNextSampleId();
  await addDoc(collection(db, "d_sample"), {
    id,
    barcode,
    location,
    date: serverTimestamp(),
    driver: driverName,
  });
}

export default Scanner;
