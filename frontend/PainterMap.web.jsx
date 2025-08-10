import React, { useEffect, useMemo, useState } from "react";
import { GoogleMap, Marker, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import Constants from "expo-constants";

export default function PainterMap({
  template, // { templateId, center, radiusMeters }
  height = 300,
  trails = {}, // { username: [{latitude, longitude}, ...] }
  latestPositions = {}, // { username: { latitude, longitude } }
  playerColors = {}, // { username: '#rrggbb' }
  disableInteractions = true,
}) {
  const [myRegion, setMyRegion] = useState(null);

  // Extract template data
  const templateId = template?.templateId;
  const center = template?.center;
  const radius = template?.radiusMeters;

  useEffect(() => {
    if (center && center.lat && center.lng) {
      setMyRegion({ lat: center.lat, lng: center.lng });
    }
  }, [center]);

  const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // --- helpers ---
  const metersToDegLat = (m) => m / 111_320;
  const metersToDegLng = (m, lat) => m / (111_320 * Math.cos((lat * Math.PI) / 180));

  const vertices = useMemo(() => {
    if (!center || !templateId || !radius) return [];
    const { lat, lng } = center;
    const dLat = metersToDegLat(radius);
    const dLng = metersToDegLng(radius, lat);

    if (templateId === "square") {
      return [
        { lat: lat + dLat, lng: lng - dLng },
        { lat: lat + dLat, lng: lng + dLng },
        { lat: lat - dLat, lng: lng + dLng },
        { lat: lat - dLat, lng: lng - dLng },
      ];
    }
    if (templateId === "triangle") {
      const top = { lat: lat + dLat, lng: lng };
      const left = { lat: lat - dLat, lng: lng - dLng };
      const right = { lat: lat - dLat, lng: lng + dLng };
      return [top, right, left];
    }
    if (templateId === "circle") {
      const points = [];
      for (let i = 0; i < 32; i++) {
        const angle = (2 * Math.PI * i) / 32;
        const dLatC = dLat * Math.cos(angle);
        const dLngC = dLng * Math.sin(angle);
        points.push({ lat: lat + dLatC, lng: lng + dLngC });
      }
      return points;
    }
    if (templateId === "star") {
      const points = [];
      const numPoints = 10;
      const outerR = 1;
      const innerR = 0.4;
      for (let i = 0; i < numPoints; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / 2) + (2 * Math.PI * i) / numPoints;
        const dLatS = dLat * r * Math.cos(angle);
        const dLngS = dLng * r * Math.sin(angle);
        points.push({ lat: lat + dLatS, lng: lng + dLngS });
      }
      return points;
    }
    return [];
  }, [center, radius, templateId]);

  if (!isLoaded) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>Loading map…</span>
      </div>
    );
  }

  if (!myRegion || !center) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <span>
          Location unavailable. Check site permission.
        </span>
      </div>
    );
  }

  const googleSymbolCircle = (typeof window !== 'undefined' && window.google && window.google.maps && window.google.maps.SymbolPath && window.google.maps.SymbolPath.CIRCLE) || null;

  return (
    <div style={{ height, position: "relative" }}>
      <GoogleMap
        mapContainerStyle={{ height: "100%", width: "100%" }}
        center={myRegion}
        zoom={16}
        options={{ disableDefaultUI: true, draggable: !disableInteractions }}
      >
        {center && (
          <Marker
            position={center}
            draggable={false}
          />
        )}
        {vertices.length >= 3 && (
          <Polygon
            paths={vertices}
            options={{
              strokeColor: "#21a4d6",
              fillColor: "#21a4d6",
              fillOpacity: 0.12,
              strokeWeight: 2,
            }}
          />
        )}
        {/* Trails */}
        {Object.entries(trails).map(([user, points]) => (
          points && points.length > 1 ? (
            <Polyline
              key={`trail-${user}`}
              path={points.map(p => ({ lat: p.latitude, lng: p.longitude }))}
              options={{ strokeColor: playerColors[user] || "#ff6600", strokeWeight: 4, strokeOpacity: 0.9 }}
            />
          ) : null
        ))}
        {/* Latest markers */}
        {Object.entries(latestPositions).map(([user, pos]) => (
          pos && pos.latitude != null && pos.longitude != null ? (
            <Marker
              key={`marker-${user}`}
              position={{ lat: pos.latitude, lng: pos.longitude }}
              icon={googleSymbolCircle ? {
                path: googleSymbolCircle,
                scale: 6,
                fillColor: playerColors[user] || "#ff6600",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              } : undefined}
            />
          ) : null
        ))}
      </GoogleMap>
      <span style={{ position: "absolute", top: 10, left: 10, background: "rgba(255,255,255,0.9)", padding: "6px 10px", borderRadius: 8 }}>
        {templateId ? `Template: ${templateId} • Radius: ${Math.round(radius)}m` : "No template"}
      </span>
    </div>
  );
}