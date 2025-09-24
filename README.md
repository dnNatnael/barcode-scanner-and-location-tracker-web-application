# Barcode Scanner and Location Tracker Web Application

A comprehensive web application for barcode scanning and real-time driver location tracking with precise GPS coordinate mapping.

---

## Table of Contents

- [Barcode Scanner and Location Tracker Web Application](#barcode-scanner-and-location-tracker-web-application)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
    - [🚗 Real-Time GPS Location Tracking](#-real-time-gps-location-tracking)
    - [📱 Driver Features](#-driver-features)
    - [👨‍💼 Admin Features](#-admin-features)
    - [🧑‍💻 IT/Admin Management](#-itadmin-management)
  - [How to Download the Project](#how-to-download-the-project)
    - [Using Git (Recommended)](#using-git-recommended)
    - [Download as ZIP](#download-as-zip)
  - [How to Install the Package and Modules](#how-to-install-the-package-and-modules)
  - [How to Use the Project](#how-to-use-the-project)
    - [Example Usage](#example-usage)
  - [How to Run the Project](#how-to-run-the-project)
  - [GPS Tracking Workflow](#gps-tracking-workflow)
  - [Technical Specifications](#technical-specifications)
  - [Browser Compatibility](#browser-compatibility)
  - [Security and Privacy](#security-and-privacy)
  - [Contributing](#contributing)
  - [License](#license)

---

## Features

### 🚗 Real-Time GPS Location Tracking

- **Continuous GPS Tracking**: Uses browser Geolocation API for real-time updates.
- **High Accuracy Mode**: Enabled for GPS-level precision.
- **Precise Coordinates**: Latitude and longitude stored with 6 decimal places.
- **Accuracy Monitoring**: Displays GPS accuracy in meters.
- **Timestamp Tracking**: Records when each location update occurs.
- **Live Map Display**: Driver positions update in real-time on the map.
- **Accuracy Circles**: Visual indicators show GPS accuracy around each marker.
- **Address Resolution**: Converts GPS coordinates to human-readable addresses using OpenStreetMap Nominatim.

### 📱 Driver Features

- **Barcode Scanning**: Scan barcodes using the camera ([`src/components/DriverDashboard/Scanner.js`](src/components/DriverDashboard/Scanner.js)).
- **Sample Collection**: Record sample types and locations ([`src/components/Pages/DriverSampleScan.js`](src/components/Pages/DriverSampleScan.js)).
- **GPS Tracking**: Automatic location tracking when active.
- **Status Management**: Start/stop location sharing ([`src/components/Pages/NetworkStatus.js`](src/components/Pages/NetworkStatus.js)).

### 👨‍💼 Admin Features

- **Driver Monitoring**: View all drivers on a single map ([`src/components/AdminDashboard/LocationTracker.js`](src/components/AdminDashboard/LocationTracker.js)).
- **Individual Tracking**: Focus on specific drivers ([`src/components/AdminDashboard/OneDriver.js`](src/components/AdminDashboard/OneDriver.js)).
- **Sample Management**: View and approve samples ([`src/components/Pages/Samples.js`](src/components/Pages/Samples.js), [`src/components/Pages/AdminView.js`](src/components/Pages/AdminView.js)).
- **Network Status**: Monitor online/offline status.

### 🧑‍💻 IT/Admin Management

- **User Approval/Resignation**: Approve, remove, or resignate users ([`src/components/Pages/IT.js`](src/components/Pages/IT.js), [`src/components/Pages/Resignated.js`](src/components/Pages/Resignated.js)).
- **Signup/Login**: IT/Admin/Driver signup and login ([`src/components/Pages/Signup.js`](src/components/Pages/Signup.js), [`src/components/Pages/Login.js`](src/components/Pages/Login.js), [`src/components/Pages/ItSignup.js`](src/components/Pages/ItSignup.js)).

---

## How to Download the Project

You can download the project by cloning the repository from GitHub.

### Using Git (Recommended)

```sh
git clone https://github.com/your-username/barcode-scanner-and-location-tracker-web-application.git
```

### Download as ZIP

1. Go to the GitHub repository page.
2. Click the green **Code** button.
3. Select **Download ZIP**.
4. Extract the ZIP file to your desired location.

---

## How to Install the Package and Modules

Before installing, make sure you have [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.

1. **Open a terminal** and navigate to the project folder:

    ```sh
    cd barcode-scanner-and-location-tracker-web-application
    ```

2. **Install dependencies** using npm:

    ```sh
    npm install
    ```

> **Note:**  
> If your project uses Python for backend or scripts, set up a virtual environment and install Python dependencies:
>
> ```sh
> python -m venv venv
> venv\Scripts\activate   # On Windows
> source venv/bin/activate # On macOS/Linux
> pip install -r requirements.txt
> ```

---

## How to Use the Project

After installation, you can interact with the application as follows:

- **Drivers**:  
  - Login to the app.
  - Start GPS tracking and scan barcodes for sample collection.
  - Stop tracking when finished.

- **Admins**:  
  - Login to the app.
  - Monitor all drivers on the map in real-time.
  - View and approve collected samples.

- **IT/Admins**:  
  - Manage user approvals and resignations.
  - Access signup and login features for different roles.

### Example Usage

- Start the app, login as a driver, and click "Start GPS Tracking".
- Scan a barcode using your device camera.
- Admins can view driver locations and sample status on the dashboard.

---

## How to Run the Project

To start the web application, use the following command in your terminal:

```sh
npm start
```

This will launch the development server.  
Open your browser and go to [http://localhost:3000](http://localhost:3000) to use the application.

> **Tip:**  
> If you use Python scripts, run them as follows:
>
> ```sh
> python script_name.py
> ```

---

## GPS Tracking Workflow

1. **Driver Login**: Authenticate and navigate to Network Status.
2. **Start Tracking**: Click "Start GPS Tracking" to begin location sharing.
3. **Continuous Updates**: GPS coordinates update automatically as driver moves.
4. **Admin Monitoring**: Admins see real-time driver positions on the map.
5. **Stop Tracking**: Driver can stop location sharing when finished.

---

## Technical Specifications

- **Frontend**: React ([`src/App.js`](src/App.js)), React Router, Leaflet for maps.
- **Backend**: Firebase Firestore ([`src/firebase.js`](src/firebase.js)).
- **Barcode Scanning**: html5-qrcode ([`src/components/DriverDashboard/Scanner.js`](src/components/DriverDashboard/Scanner.js)).
- **Map Display**: react-leaflet ([`src/components/AdminDashboard/LocationTracker.js`](src/components/AdminDashboard/LocationTracker.js)).
- **Sample Data Structure**:
  ```javascript
  {
    SID: "SID-<barcode>_<number>",
    barcode: "<barcode>",
    sampleType: "<type>",
    location: "<location>",
    date: <timestamp>,
    arrivedDate: <timestamp>,
    driver: "<driverId>",
    driverName: "<driverName>"
  }
  ```
- **Location Data Structure**:
  ```javascript
  location: {
    latitude: 9.145000,
    longitude: 40.489700,
    accuracy: 5,
    timestamp: "2024-01-15T10:30:00.000Z"
  }
  ```

---

## Browser Compatibility

- Modern browser with Geolocation API support.
- HTTPS connection required for GPS access.
- User permission for location access.
- GPS-enabled device for high accuracy.

---

## Security and Privacy

- GPS coordinates are stored securely in Firebase.
- Location sharing can be stopped at any time.
- Only authorized users can view driver locations.
- Location data is only shared when explicitly enabled.

---

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Test GPS and barcode functionality.
5. Submit a pull request.

---

## License

This project is licensed under the MIT License.
