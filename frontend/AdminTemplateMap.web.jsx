import React, { useEffect, useMemo, useState, useCallback } from "react";
import { GoogleMap, Marker, Polygon, useJsApiLoader } from "@react-google-maps/api";
import Constants from "expo-constants";

export default function AdminTemplateMap({
  initialRadiusMeters = 120,
  onConfirm,
}) {
  const [loading, setLoading] = useState(true);
  const [myRegion, setMyRegion] = useState(null);

  const [templateId, setTemplateId] = useState(null); // 'square' | 'triangle'
  const [center, setCenter] = useState(null);
  const [radius, setRadius] = useState(initialRadiusMeters);
  const [locked, setLocked] = useState(false);

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
      <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span>Loading map…</span>
      </div>
    );
  }

  if (!myRegion || !center) {
    return (
      <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <span>
          Location unavailable. Check site permission.
        </span>
      </div>
    );
  }

  return (
    <div style={{ height: 300, position: "relative" }}>
      {/* Template picker */}
      <div style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", gap: 8 }}>
        <button
          disabled={locked}
          onClick={() => setTemplateId("square")}
          style={{
            background: templateId === "square" ? "#21a4d6" : "#fff",
            color: templateId === "square" ? "#fff" : "#21a4d6",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #21a4d6",
            fontWeight: 600,
            cursor: locked ? "not-allowed" : "pointer",
          }}
        >
          Square
        </button>
        <button
          disabled={locked}
          onClick={() => setTemplateId("triangle")}
          style={{
            background: templateId === "triangle" ? "#21a4d6" : "#fff",
            color: templateId === "triangle" ? "#fff" : "#21a4d6",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #21a4d6",
            fontWeight: 600,
            cursor: locked ? "not-allowed" : "pointer",
          }}
        >
          Triangle
        </button>
      </div>

      <GoogleMap
        mapContainerStyle={{ height: "100%", width: "100%" }}
        center={myRegion}
        zoom={16}
        options={{ disableDefaultUI: true, draggable: !locked }}
        onClick={(e) => {
          if (!locked) {
            setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }
        }}
      >
        {center && (
          <Marker
            position={center}
            draggable={!locked}
            onDragEnd={(e) => {
              if (!locked) {
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

      {/* Bottom controls */}
      <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <button
            disabled={locked}
            onClick={() => bumpRadius(1 / 1.15)}
            style={{
              background: locked ? "#ccc" : "#fff",
              border: "1px solid #21a4d6",
              padding: "10px 14px",
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
              padding: "10px 14px",
              borderRadius: 8,
              color: locked ? "#777" : "#21a4d6",
              fontWeight: 700,
              cursor: locked ? "not-allowed" : "pointer",
            }}
          >
            + Size
          </button>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {!locked ? (
            <button
              disabled={!templateId}
              onClick={handleSet}
              style={{
                background: templateId ? "#20b265" : "#ccc",
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 10,
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
                padding: "12px 18px",
                borderRadius: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          )}
        </div>

        <span style={{ marginTop: 10, background: "rgba(255,255,255,0.9)", padding: "6px 10px", borderRadius: 8 }}>
          {templateId ? `Template: ${templateId} • Radius: ${Math.round(radius)}m` : "Choose a template"}
        </span>
      </div>
    </div>
  );
}