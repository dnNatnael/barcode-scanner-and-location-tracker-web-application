# Barcode Scanner and Location Tracker Web Application

A comprehensive web application for barcode scanning and real-time driver location tracking with precise GPS coordinate mapping.

## Features

### 🚗 Real-Time GPS Location Tracking

The application provides **precise real-time GPS coordinate mapping** for drivers with the following advanced features:

#### High-Accuracy GPS Positioning
- **Continuous GPS Tracking**: Uses `navigator.geolocation.watchPosition()` for real-time location updates
- **High Accuracy Mode**: Enabled with `enableHighAccuracy: true` for GPS-level precision
- **Precise Coordinates**: Stores latitude and longitude with 6 decimal places (accuracy to ~1 meter)
- **Accuracy Monitoring**: Tracks GPS accuracy in meters and displays it on the map
- **Timestamp Tracking**: Records when each location update occurs

#### Real-Time Map Display
- **Live Markers**: Driver positions update in real-time on the map
- **Accuracy Circles**: Visual indicators show GPS accuracy around each marker
- **Precise Positioning**: Markers appear at exact geographical coordinates
- **Location Details**: Popup shows exact coordinates, accuracy, and last update time
- **Address Resolution**: Converts GPS coordinates to human-readable addresses

#### GPS Status Indicators
- **Driver Dashboard**: Shows GPS tracking status with current coordinates
- **Admin Dashboard**: Displays all online drivers with their precise locations
- **Individual Tracking**: Dedicated page for tracking specific drivers
- **Network Status**: Real-time online/offline status with location visibility

#### Technical Implementation
```javascript
// Continuous GPS tracking with high accuracy
navigator.geolocation.watchPosition(
  async (position) => {
      const { latitude, longitude, accuracy } = position.coords;
          // Update driver location with precise coordinates
              await updateDoc(driverDocRef, {
                    location: {
                            latitude: latitude,        // Precise latitude
                                    longitude: longitude,      // Precise longitude
                                            accuracy: accuracy,        // GPS accuracy in meters
                                                    timestamp: new Date().toISOString()
                                                          }
                                                              });
                                                                },
                                                                  null,
                                                                    {
                                                                        enableHighAccuracy: true,    // Use GPS for highest accuracy
                                                                            maximumAge: 10000,          // Accept cached positions up to 10 seconds
                                                                                timeout: 15000              // Wait up to 15 seconds for position
                                                                                  }
                                                                                  );
                                                                                  ```

                                                                                  #### Map Integration
                                                                                  - **Leaflet Maps**: Uses OpenStreetMap tiles for accurate geographical display
                                                                                  - **Custom Markers**: Visual indicators with accuracy circles
                                                                                  - **Real-Time Updates**: Markers move as drivers move
                                                                                  - **Coordinate Display**: Shows exact GPS coordinates in popups
                                                                                  - **Address Lookup**: Integrates with OpenStreetMap Nominatim for address resolution

                                                                                  ### 📱 Driver Features
                                                                                  - **Barcode Scanning**: Scan barcodes with camera
                                                                                  - **Sample Collection**: Record sample types and locations
                                                                                  - **GPS Tracking**: Automatic location tracking when active
                                                                                  - **Status Management**: Start/stop location sharing

                                                                                  ### 👨‍💼 Admin Features
                                                                                  - **Driver Monitoring**: View all drivers on a single map
                                                                                  - **Individual Tracking**: Focus on specific drivers
                                                                                  - **Real-Time Updates**: Live location updates
                                                                                  - **Network Status**: Monitor online/offline status

                                                                                  ## GPS Tracking Workflow

                                                                                  1. **Driver Login**: Driver authenticates and navigates to Network Status
                                                                                  2. **Start Tracking**: Click "Start GPS Tracking" to begin location sharing
                                                                                  3. **Initial Position**: System captures initial GPS position with high accuracy
                                                                                  4. **Continuous Updates**: GPS coordinates update automatically as driver moves
                                                                                  5. **Admin Monitoring**: Admins can see real-time driver positions on the map
                                                                                  6. **Precise Mapping**: Markers appear at exact geographical coordinates
                                                                                  7. **Stop Tracking**: Driver can stop location sharing when finished

                                                                                  ## Technical Specifications

                                                                                  ### GPS Accuracy
                                                                                  - **High Accuracy Mode**: Enabled for GPS-level precision
                                                                                  - **Coordinate Precision**: 6 decimal places (accuracy to ~1 meter)
                                                                                  - **Update Frequency**: Continuous updates as driver moves
                                                                                  - **Accuracy Monitoring**: Real-time accuracy measurement in meters

                                                                                  ### Location Data Structure
                                                                                  ```javascript
                                                                                  location: {
                                                                                    latitude: 9.145000,           // Precise latitude
                                                                                      longitude: 40.489700,         // Precise longitude
                                                                                        accuracy: 5,                  // GPS accuracy in meters
                                                                                          timestamp: "2024-01-15T10:30:00.000Z"  // ISO timestamp
                                                                                          }
                                                                                          ```

                                                                                          ### Map Features
                                                                                          - **Real-Time Markers**: Update automatically with driver movement
                                                                                          - **Accuracy Circles**: Visual representation of GPS precision
                                                                                          - **Coordinate Display**: Exact GPS coordinates shown in popups
                                                                                          - **Address Resolution**: Human-readable addresses from coordinates
                                                                                          - **Status Indicators**: Online/offline status with location visibility

                                                                                          ## Installation and Setup

                                                                                          1. Clone the repository
                                                                                          2. Install dependencies: `npm install`
                                                                                          3. Configure Firebase settings in `src/firebase.js`
                                                                                          4. Start the development server: `npm start`

                                                                                          ## Usage

                                                                                          ### For Drivers
                                                                                          1. Login to the application
                                                                                          2. Navigate to Network Status
                                                                                          3. Click "Start GPS Tracking"
                                                                                          4. Allow location access when prompted
                                                                                          5. Begin scanning barcodes and collecting samples
                                                                                          6. Click "Finished" to stop location tracking

                                                                                          ### For Admins
                                                                                          1. Login to the application
                                                                                          2. View the main dashboard with all drivers
                                                                                          3. Click on individual drivers to track them specifically
                                                                                          4. Monitor real-time GPS positions on the map
                                                                                          5. View precise coordinates and accuracy information

                                                                                          ## Browser Compatibility

                                                                                          The GPS tracking features require:
                                                                                          - Modern browser with Geolocation API support
                                                                                          - HTTPS connection (required for GPS access)
                                                                                          - User permission for location access
                                                                                          - GPS-enabled device for high accuracy

                                                                                          ## Security and Privacy

                                                                                          - GPS coordinates are stored securely in Firebase
                                                                                          - Location sharing can be stopped at any time
                                                                                          - Only authorized users can view driver locations
                                                                                          - Location data is only shared when explicitly enabled

                                                                                          ## Contributing

                                                                                          1. Fork the repository
                                                                                          2. Create a feature branch
                                                                                          3. Make your changes
                                                                                          4. Test GPS functionality
                                                                                          5. Submit a pull request

                                                                                          ## License

                                                                                          This project is licensed under the MIT License.
                                                                                          