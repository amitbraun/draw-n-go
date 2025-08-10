import React, { useEffect, useMemo, useState, useCallback } from "react";
import { GoogleMap, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import Constants from "expo-constants";

export default function AdminTemplateMap({
  initialRadiusMeters = 120,
  onConfirm,
  template,
  hideControls = false,
  initialCenter,
  height = '100%'
}) {
  const [loading, setLoading] = useState(true);
  const [myRegion, setMyRegion] = useState(null);

  // If hideControls, always use template prop for display
  const [templateId, setTemplateId] = useState(null); // 'square' | 'triangle'
  const [center, setCenter] = useState(null);
  const [radius, setRadius] = useState(initialRadiusMeters);
  const [locked, setLocked] = useState(false);

  // Sync state with template prop for non-admins
  useEffect(() => {
    if (hideControls && template) {
      setTemplateId(template.templateId || null);
      setCenter(template.center || null);
      setRadius(template.radiusMeters || initialRadiusMeters);
      setLocked(true);
      // Center map on template center
      if (template.center && template.center.lat && template.center.lng) {
        setMyRegion({ lat: template.center.lat, lng: template.center.lng });
      }
    }
    if (hideControls && !template) {
      setTemplateId(null);
      setCenter(null);
      setRadius(initialRadiusMeters);
      setLocked(true);
    }
  }, [hideControls, template, initialRadiusMeters]);

  // For admin, center map on template center if set, else use initialCenter
  useEffect(() => {
    if (!hideControls) {
      if (center && center.lat && center.lng) {
        setMyRegion({ lat: center.lat, lng: center.lng });
      } else if (initialCenter) {
        setMyRegion({ lat: initialCenter.latitude, lng: initialCenter.longitude });
      }
    }
  }, [hideControls, center, initialCenter]);

  // For admin, set initial center if provided
  useEffect(() => {
    if (!hideControls && initialCenter) {
      setCenter({ lat: initialCenter.latitude, lng: initialCenter.longitude });
    }
  }, [hideControls, initialCenter]);

  const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // --- helpers ---
  const metersToDegLat = (m) => m / 111_320;
  const metersToDegLng = (m, lat) => m / (111_320 * Math.cos((lat * Math.PI) / 180));

  const vertices = useMemo(() => {
    if (!center || !templateId) return [];
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
      // Approximate circle with polygon (32 points)
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
      // 5-pointed star, alternating outer/inner radius
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

  // --- permissions + current location (web-safe with browser geolocation) ---
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCenter({ lat, lng });
          setMyRegion({ lat, lng });
          setLoading(false);
        },
        () => {
          setLoading(false);
        }
      );
    } else {
      setLoading(false);
    }
  }, []);

  const bumpRadius = useCallback(
    (mult) => {
      if (locked) return;
      setRadius((r) => Math.max(10, Math.min(5000, Math.round(r * mult))));
    },
    [locked]
  );

  const handleSet = useCallback(() => {
    if (!templateId || !center) return;
    setLocked(true);
    onConfirm?.({
      templateId,
      center,
      radiusMeters: radius,
      vertices,
    });
  }, [templateId, center, radius, vertices, onConfirm]);

  const handleEdit = useCallback(() => setLocked(false), []);

  if (!isLoaded || loading) {
    return (
      <div style={{ height: height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>Loading map…</span>
      </div>
    );
  }

  if (!myRegion || !center) {
    return (
      <div style={{ height: height, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <span>
          Location unavailable. Check site permission.
        </span>
      </div>
    );
  }

  return (
    <div style={{ height: height, position: "relative" }}>
      {/* Top-right: template dropdown with size and set/edit stacked below */}
      {!hideControls && (
        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <select
            disabled={locked}
            value={templateId || ''}
            onChange={e => setTemplateId(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid #21a4d6",
              fontWeight: 600,
              color: "#21a4d6",
              background: "#fff",
              minWidth: 140
            }}
          >
            <option value="" disabled>Select shape…</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="circle">Circle</option>
            <option value="star">Star</option>
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={locked}
              onClick={() => bumpRadius(1 / 1.15)}
              style={{
                background: locked ? "#ccc" : "#fff",
                border: "1px solid #21a4d6",
                padding: "6px 10px",
                borderRadius: 8,
                color: locked ? "#777" : "#21a4d6",
                fontWeight: 700,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              − Size
            </button>
            <button
              disabled={locked}
              onClick={() => bumpRadius(1.15)}
              style={{
                background: locked ? "#ccc" : "#fff",
                border: "1px solid #21a4d6",
                padding: "6px 10px",
                borderRadius: 8,
                color: locked ? "#777" : "#21a4d6",
                fontWeight: 700,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              + Size
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {!locked ? (
              <button
                disabled={!templateId}
                onClick={handleSet}
                style={{
                  background: templateId ? "#20b265" : "#ccc",
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: templateId ? "pointer" : "not-allowed",
                }}
              >
                Set
              </button>
            ) : (
              <button
                onClick={handleEdit}
                style={{
                  background: "#21a4d6",
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
            )}
          </div>

          <span style={{ fontSize: 12, background: "rgba(255,255,255,0.9)", padding: "4px 8px", borderRadius: 8 }}>
            {templateId ? `Template: ${templateId} • Radius: ${Math.round(radius)}m` : "Choose a template"}
          </span>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={{ height: "100%", width: "100%" }}
        center={myRegion}
        zoom={16}
        options={{ disableDefaultUI: true, draggable: !locked }}
        onClick={(e) => {
          if (!locked && !hideControls) {
            setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
            setMyRegion({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        }}
        onCenterChanged={() => {
          // For admin, allow moving map freely
          if (!hideControls) {
            const map = window.google && window.google.maps && window.google.maps.Map ? window.google.maps.Map : null;
            // No-op: react-google-maps handles this
          }
        }}
      >
        {center && (
          <Marker
            position={center}
            draggable={!locked && !hideControls}
            onDragEnd={(e) => {
              if (!locked && !hideControls) {
                setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }
            }}
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
      </GoogleMap>
    </div>
  );
}