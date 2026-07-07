const axios = require("axios");

class GoogleMapService {

    /**
     * Get Route Details from Google Directions API
     */
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
                        departure_time: departureTimestamp,
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

                throw new Error(
                    data.error_message ||
                    "Unable to fetch route from Google Maps."
                );

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

            throw new Error(err.message);

        }

    }

    /**
     * Decode Google Encoded Polyline
     */
    static decodePolyline(encoded) {

        let points = [];

        let index = 0;
        let lat = 0;
        let lng = 0;

        while (index < encoded.length) {

            let result = 1;
            let shift = 0;
            let b;

            do {

                b = encoded.charCodeAt(index++) - 63 - 1;
                result += b << shift;
                shift += 5;

            } while (b >= 0x1f);

            lat += (result & 1)
                ? ~(result >> 1)
                : (result >> 1);

            result = 1;
            shift = 0;

            do {

                b = encoded.charCodeAt(index++) - 63 - 1;
                result += b << shift;
                shift += 5;

            } while (b >= 0x1f);

            lng += (result & 1)
                ? ~(result >> 1)
                : (result >> 1);

            points.push({
                lat: lat * 1e-5,
                lng: lng * 1e-5
            });

        }

        return points;

    }

}

module.exports = GoogleMapService;