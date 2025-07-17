import React from "react";
import { useNavigate } from "react-router-dom";
import "../Styles/FrontPage.css";

const FrontPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate("/choose");
  };

  return (
    <div className="frontpage-container">
      <div className="frontpage-content">
        <h1 className="frontpage-title">Welcome International Clinical Laboratory</h1>
        <p className="frontpage-subtitle">Track locations and scan barcodes with ease.</p>
        <button className="get-started-btn" onClick={handleGetStarted}>
          Get Started
        </button>
      </div>
    </div>
  );
};

export default FrontPage;
