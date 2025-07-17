import React from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/UserTypeSelect.css";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../../firebase";

const functions = getFunctions(app);

const UserTypeSelection = () => {
  const navigate = useNavigate();

  const handleRemove = async (userId, uid) => {
    // 1. Delete from Firestore (already done)
    // await deleteDoc(doc(db, "users", userId));
    // setUsers((prev) => prev.filter((u) => u.id !== userId));
    // 2. Delete from Auth
    const deleteUserAuth = httpsCallable(functions, "deleteUserAuth");
    await deleteUserAuth({ uid });
  };

  return (
    <div className="user-type-selection-container">
      <h1 className="frontpage-title">Welcome International Clinical Laboratory</h1>
      <h2>Select User Type</h2>
      <div className="user-type-buttons">
        <button onClick={() => navigate("/it-login")}>IT</button>
        <button onClick={() => navigate("/login")}>User</button>
      </div>
    </div>
  );
};

export default UserTypeSelection;
