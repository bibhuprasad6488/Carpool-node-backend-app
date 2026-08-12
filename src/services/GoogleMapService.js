const axios = require("axios");

class GoogleMapService {
    static async getRouteDetails(
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        departureTimestamp
    ) {
        try {
            const response = await axios.get(
                "https://maps.googleapis.com/maps/api/directions/json",
                {
                    params: {
                        origin: `${pickupLat},${pickupLng}`,
                        destination: `${dropLat},${dropLng}`,
                        mode: "driving",
                        departure_time: departureTimestamp || "now",
                        key: process.env.GOOGLE_MAPS_API_KEY
                    }
                }
            );

            const data = response.data;

            if (
                data.status !== "OK" ||
                !data.routes ||
                data.routes.length === 0
            ) {
                const apiErrorMessage =
                    data.error_message ||
                    `Google Maps API returned status: ${data.status}`;
                
                throw new Error(apiErrorMessage);
            }

            const route = data.routes[0];
            const leg = route.legs[0];

            return {
                polyline: route.overview_polyline.points,
                distance: leg.distance.value,
                duration: leg.duration.value,
                duration_in_traffic:
                    leg.duration_in_traffic
                        ? leg.duration_in_traffic.value
                        : leg.duration.value,
                start_address: leg.start_address,
                end_address: leg.end_address
            };

        } catch (err) {
            // Attach original error context using the cause property
            throw new Error(err.message, { cause: err });
        }
    }

    static decodePolyline(encoded) {
        if (!encoded) return [];

        let points = [];
        let index = 0;
        let lat = 0;
        let lng = 0;

        while (index < encoded.length) {
            let result = 0;
            let shift = 0;
            let b;

            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            let dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
            lat += dlat;

            result = 0;
            shift = 0;

            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);

            let dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
            lng += dlng;

            points.push({
                lat: lat * 1e-5,
                lng: lng * 1e-5
            });
        }

        return points;
    }
}

module.exports = GoogleMapService;