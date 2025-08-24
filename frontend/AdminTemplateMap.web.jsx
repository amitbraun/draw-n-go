import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { GoogleMap, Marker, Polygon, Polyline, useJsApiLoader } from "@react-google-maps/api";
import Constants from "expo-constants";

export default function AdminTemplateMap({
  initialRadiusMeters = 120,
  onConfirm,
  template,
  hideControls = false,
  initialCenter,
  height = '100%',
  defaultCenter,
  sessionId,
  username
}) {
  const [loading, setLoading] = useState(true);
  const [myRegion, setMyRegion] = useState(null);

  // If hideControls, always use template prop for display
  const [templateId, setTemplateId] = useState(null); // 'square' | 'triangle'
  const [center, setCenter] = useState(null);
  const [radius, setRadius] = useState(initialRadiusMeters);
  const [locked, setLocked] = useState(false);
  const [zoom, setZoom] = useState(16);

  const [customVertices, setCustomVertices] = useState([]); // for Polygon template
  const [prevClearedVertices, setPrevClearedVertices] = useState(null); // backup for clear/undo
  // Added: catalog state for template definitions (fix for undefined 'catalog')
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const mapRef = useRef(null);
  const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Sync state with template prop for non-admins
  useEffect(() => {
    if (hideControls && template) {
      setTemplateId(template.templateId || null);
      setCenter(template.center || null);
      setRadius(template.radiusMeters || initialRadiusMeters);
      setLocked(true);
      if (template.center && template.center.lat && template.center.lng) {
        setMyRegion({ lat: template.center.lat, lng: template.center.lng });
      }
      return;
    }
    // Before any template is set, non-admins use defaultCenter from backend (admin’s location)
    if (hideControls && !template && defaultCenter && defaultCenter.latitude && defaultCenter.longitude) {
      const c = { lat: defaultCenter.latitude, lng: defaultCenter.longitude };
      setCenter(c);
      setMyRegion(c);
      setLocked(true);
      return;
    }
    if (hideControls && !template) {
      setTemplateId(null);
      setCenter(null);
      setRadius(initialRadiusMeters);
      setLocked(true);
    }
  }, [hideControls, template, defaultCenter, initialRadiusMeters]);

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

  // For admin, set initial center if provided (only when no template has been selected yet)
  useEffect(() => {
    if (!hideControls && initialCenter && (templateId == null)) {
      setCenter({ lat: initialCenter.latitude, lng: initialCenter.longitude });
    }
  }, [hideControls, initialCenter, templateId]);

  // For admin, if a template exists (e.g., after ending a game), pre-fill once and lock so it's visible
  useEffect(() => {
    if (!hideControls && template && (templateId == null)) {
      setTemplateId(template.templateId || null);
      if (template.center && template.center.lat && template.center.lng) {
        const c = { lat: template.center.lat, lng: template.center.lng };
        setCenter(c);
        setMyRegion(c);
      }
      setRadius(template.radiusMeters || initialRadiusMeters);
      setLocked(true);
    }
  }, [hideControls, template, templateId, initialRadiusMeters]);

  const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // --- helpers ---
  const metersToDegLat = (m) => m / 111_320;
  const metersToDegLng = (m, lat) => m / (111_320 * Math.cos((lat * Math.PI) / 180));

  // Normalize any center object to {lat,lng} (accepts {lat,lng} or {latitude,longitude} and numeric strings)
  const normalizeCenter = useCallback((c) => {
    if (!c || typeof c !== 'object') return null;
    let lat = c.lat ?? c.latitude;
    let lng = c.lng ?? c.longitude;
    if (lat == null || lng == null) return null;
    lat = Number(lat); lng = Number(lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  }, []);

  // Ensure internal center stays normalized whenever template or center changes
  useEffect(() => {
    setCenter(prev => normalizeCenter(prev) || prev);
  }, [normalizeCenter]);

  // Update myRegion whenever center normalizes
  useEffect(() => {
    const nc = normalizeCenter(center);
    if (nc) setMyRegion(nc);
  }, [center, normalizeCenter]);

  // New: derive generatedVertices from catalog entry instead of hardcoded shape math (except polygon)
  // EXPECTATION: For non-polygon shapes, catalog supplies baseVertices: array of normalized coordinates
  // Each vertex p: { x, y } in range roughly [-1,1] relative to center, describing the unit shape at radius=1.
  // We scale x by dLng and y by dLat so radiusMeters sets half-extent. Only center & radius are mutable.
  const generatedVertices = useMemo(() => {
    if (!templateId || templateId === 'polygon') return [];
    const c = normalizeCenter(center);
    if (!c) return [];
    const def = catalog.find(ca => ca.templateId === templateId);
    if (!def || !Array.isArray(def.baseVertices)) return [];
    const { lat, lng } = c;
    const dLat = metersToDegLat(radius);
    const dLng = metersToDegLng(radius, lat);
    return def.baseVertices.map(p => ({
      lat: lat + (p.y || 0) * dLat,
      lng: lng + (p.x || 0) * dLng
    }));
  }, [center, templateId, radius, catalog, normalizeCenter]);

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

  // --- permissions + current location (avoid overriding existing template) ---
  useEffect(() => {
    if (center) { setLoading(false); return; }
    if (template && template.center && template.center.lat && template.center.lng) {
      // Respect existing template center entirely
      const c = { lat: template.center.lat, lng: template.center.lng };
      setCenter(c); setMyRegion(c); setLoading(false); return;
    }
    if (hideControls) { setLoading(false); return; }
    if (!hideControls && template && templateId != null) { setLoading(false); return; }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude; const lng = pos.coords.longitude;
          setCenter({ lat, lng }); setMyRegion({ lat, lng }); setLoading(false);
        },
        () => setLoading(false)
      );
    } else { setLoading(false); }
  }, [hideControls, template, templateId, center]);

  const bumpRadius = useCallback(
    (mult) => {
      if (locked) return;
      setRadius((r) => Math.max(10, Math.min(5000, Math.round(r * mult))));
    },
    [locked]
  );

  // Helper: derive zoom from radius to maintain on-screen size
  const radiusToZoom = useCallback((rMeters) => {
    // Basic mapping: smaller radius => higher zoom. Tuned empirically.
    if (!rMeters) return 16;
    const clamped = Math.max(20, Math.min(2000, rMeters));
    const z = 18 - Math.log2(clamped / 50); // 50m ~ z=18 baseline
    return Math.max(12, Math.min(20, Math.round(z)));
  }, []);

  // Apply template zoom for non-admins, or when template updates
  useEffect(() => {
    if (hideControls && template && template.zoomLevel) {
      setZoom(template.zoomLevel);
    }
  }, [hideControls, template]);

  // When admin changes radius, adjust zoom to keep on-screen size relatively constant
  useEffect(() => {
    if (!hideControls && templateId !== 'polygon') {
      setZoom(radiusToZoom(radius));
    }
  }, [radius, hideControls, radiusToZoom, templateId]);

  // Also apply zoom from existing template when loading for admin
  useEffect(() => {
    if (!hideControls && template && template.zoomLevel) {
      setZoom(template.zoomLevel);
    }
  }, [hideControls, template]);

  // Reset custom vertices when switching away
  useEffect(() => {
    if (templateId !== 'polygon') setCustomVertices([]);
  }, [templateId]);

  // If incoming template has vertices (custom polygon), load them
  useEffect(() => {
    if (template && template.vertices && Array.isArray(template.vertices) && template.templateId === 'polygon') {
      // Always store vertices; non-admins will render but without markers
      setCustomVertices(template.vertices.map(v => ({ lat: v.lat, lng: v.lng })));
      if (!hideControls) setTemplateId('polygon');
    }
  }, [template, hideControls]);

  const effectiveVertices = useMemo(() => {
    if (templateId === 'polygon') return customVertices;
    if (hideControls && template && template.templateId === 'polygon' && customVertices.length) return customVertices;
    return generatedVertices; // now derived from catalog
  }, [templateId, customVertices, generatedVertices, hideControls, template]);

  // --- map event handlers ---
  const handleMapClick = useCallback((e) => {
    if (locked || hideControls) return;
    if (templateId === 'polygon') {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setCustomVertices(prev => [...prev, { lat, lng }]);
      if (!center) {
        setCenter({ lat, lng });
        setMyRegion({ lat, lng });
      }
    } else {
      setCenter({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setMyRegion({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  }, [locked, hideControls, templateId, center]);

  const removeLastVertex = useCallback(() => {
    if (locked || hideControls || templateId !== 'polygon') return;
    if (customVertices.length === 0 && prevClearedVertices) {
      setCustomVertices(prevClearedVertices);
      setPrevClearedVertices(null);
      return;
    }
    setCustomVertices(v => v.slice(0, -1));
  }, [locked, hideControls, templateId, customVertices, prevClearedVertices]);

  const clearPolygon = useCallback(() => {
    if (locked || hideControls || templateId !== 'polygon') return;
    if (!customVertices.length) return; // nothing to clear
    setPrevClearedVertices(customVertices);
    setCustomVertices([]);
  }, [locked, hideControls, templateId, customVertices]);

  const handleVertexDrag = (idx, e) => {
    if (locked || hideControls) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setCustomVertices(prev => prev.map((p, i) => i === idx ? { lat, lng } : p));
  };

  const generatedOrCustomPolygon = effectiveVertices && effectiveVertices.length >= (templateId === 'polygon' ? 2 : 3) ? (
    templateId === 'polygon' ? (
      <Polyline path={effectiveVertices} options={{ strokeColor: '#21a4d6', strokeWeight: 2 }} />
    ) : (
      <Polygon paths={effectiveVertices} options={{ strokeColor: '#21a4d6', fillOpacity: 0, strokeWeight: 2 }} />
    )
  ) : null;

  const vertexMarkers = templateId === 'polygon' ? customVertices.map((v, i) => (
    <Marker
      key={`cv-${i}`}
      position={v}
      draggable={!locked && !hideControls}
      onDragEnd={(e) => handleVertexDrag(i, e)}
      icon={{
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: '#21a4d6',
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: '#fff'
      }}
    />
  )) : null;

  const handleSet = useCallback(() => {
    if (!templateId) return;
    // For polygon, derive center (centroid) and approximate radius (max distance to centroid in meters)
    let finalCenter = center;
    let finalRadius = radius;
    let verticesToSend = undefined;
    if (templateId === 'polygon' && customVertices.length >= 3) {
      const lats = customVertices.map(p => p.lat);
      const lngs = customVertices.map(p => p.lng);
      const centroid = { lat: lats.reduce((a,b)=>a+b,0)/lats.length, lng: lngs.reduce((a,b)=>a+b,0)/lngs.length };
      finalCenter = centroid;
      // Rough radius: max haversine distance from centroid
      const toRad = d => d * Math.PI / 180;
      const R = 6371000;
      let maxD = 0;
      customVertices.forEach(p => {
        const dLat = toRad(p.lat - centroid.lat);
        const dLng = toRad(p.lng - centroid.lng);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(centroid.lat))*Math.cos(toRad(p.lat))*Math.sin(dLng/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c;
        if (d > maxD) maxD = d;
      });
      finalRadius = Math.max(10, Math.round(maxD));
      verticesToSend = customVertices;
    }
    if (!finalCenter) return;

    // Only now (on Set) compute zoom for polygon by fitting its bounds once.
    let finalZoom = zoom;
    if (templateId === 'polygon' && mapRef.current && customVertices.length >= 3) {
      try {
        const bounds = new window.google.maps.LatLngBounds();
        customVertices.forEach(v => bounds.extend(v));
        mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
        const z = mapRef.current.getZoom();
        if (typeof z === 'number') {
          setZoom(z); // update local state
          finalZoom = z; // use in payload
        }
      } catch {}
    }

    setLocked(true);
    onConfirm?.({
      templateId,
      center: finalCenter,
      radiusMeters: finalRadius,
      vertices: verticesToSend,
      zoomLevel: finalZoom,
    });
  }, [templateId, center, radius, customVertices, onConfirm, zoom]);

  const handleEdit = useCallback(async () => {
    setLocked(false);
    // Best-effort: signal session that template is not set to prevent polling overwrite
    try {
      if (sessionId && username) {
        await fetch('https://draw-n-go.azurewebsites.net/api/JoinSession', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-username': username },
          body: JSON.stringify({ sessionId, templateSet: false })
        });
      }
    } catch {}
  }, []);

  const fitToShape = useCallback(() => {
    // For polygon while editing (unlocked), keep current zoom & center stable
    if (templateId === 'polygon' && !locked) return;
    if (!mapRef.current || !effectiveVertices || effectiveVertices.length === 0) return;
    const bounds = new window.google.maps.LatLngBounds();
    effectiveVertices.forEach(v => bounds.extend(v));
    try {
      mapRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
      const z = mapRef.current.getZoom();
      if (typeof z === 'number') setZoom(z);
    } catch {}
  }, [effectiveVertices, templateId, locked]);

  // Fit whenever shape changes (center/radius/templateId)
  useEffect(() => {
    fitToShape();
  }, [fitToShape]);

  const dropdownOptions = useMemo(() => {
    const opts = [];
    // All templateIds from catalog
    catalog.forEach(t => {
      if (t.templateId) opts.push({ id: t.templateId, label: t.templateId });
    });
    // Always append polygon option for ad-hoc custom drawing
    if (!opts.find(o => o.id === 'polygon')) opts.push({ id: 'polygon', label: 'polygon' });
    // Sort alphabetically for consistency
    return opts.sort((a,b) => a.id.localeCompare(b.id));
  }, [catalog]);

  useEffect(() => {
    // Fetch templates catalog once (read-only). Provides baseVertices for non-polygon shapes.
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('https://draw-n-go.azurewebsites.net/api/GetTemplates?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (aborted) return;
        setCatalog(Array.isArray(data.templates) ? data.templates : []);
        setCatalogLoaded(true);
      } catch (e) {
        if (aborted) return;
        setCatalogError(e.message || 'Failed to load templates');
        setCatalogLoaded(true);
      }
    })();
    return () => { aborted = true; };
  }, []);

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
              minWidth: 160
            }}
          >
            <option value="" disabled>Select template…</option>
            {dropdownOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          {catalogError && (
            <span style={{ fontSize: 10, color: 'red', maxWidth: 180, textAlign: 'right' }}>Templates load failed (fallback list in use)</span>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={locked || templateId === 'polygon'}
                onClick={() => bumpRadius(1 / 1.15)}
                style={{
                  background: (locked || templateId === 'polygon') ? '#ccc' : '#fff',
                  border: '1px solid #21a4d6',
                  padding: '6px 10px',
                  borderRadius: 8,
                  color: (locked || templateId === 'polygon') ? '#777' : '#21a4d6',
                  fontWeight: 700,
                  cursor: (locked || templateId === 'polygon') ? 'not-allowed' : 'pointer',
                }}
              >− Size</button>
              <button
                disabled={locked || templateId === 'polygon'}
                onClick={() => bumpRadius(1.15)}
                style={{
                  background: (locked || templateId === 'polygon') ? '#ccc' : '#fff',
                  border: '1px solid #21a4d6',
                  padding: '6px 10px',
                  borderRadius: 8,
                  color: (locked || templateId === 'polygon') ? '#777' : '#21a4d6',
                  fontWeight: 700,
                  cursor: (locked || templateId === 'polygon') ? 'not-allowed' : 'pointer',
                }}
              >+ Size</button>
            </div>
            {templateId === 'polygon' && !locked && (
              <>
                <button
                  onClick={removeLastVertex}
                  style={{
                    background: (customVertices.length || prevClearedVertices) ? '#ff9800' : '#ccc',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: (customVertices.length || prevClearedVertices) ? 'pointer' : 'not-allowed'
                  }}
                  disabled={!(customVertices.length || prevClearedVertices)}
                  title={customVertices.length === 0 && prevClearedVertices ? 'Restore cleared polygon' : 'Undo last point'}
                >{customVertices.length === 0 && prevClearedVertices ? 'Restore' : 'Undo Point'}</button>
                <button
                  onClick={clearPolygon}
                  style={{
                    background: customVertices.length ? '#d9534f' : '#ccc',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: customVertices.length ? 'pointer' : 'not-allowed'
                  }}
                  disabled={!customVertices.length}
                  title="Clear all points (use Undo to restore)"
                >Clear</button>
              </>
            )}
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
        zoom={zoom}
        onLoad={onMapLoad}
        options={{ disableDefaultUI: true, draggable: !locked }}
        onClick={handleMapClick}
      >
        {center && templateId !== 'polygon' && (
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
        {generatedOrCustomPolygon}
        {!hideControls && vertexMarkers}
      </GoogleMap>
      {/* Catalog debug (optional) */}
      {/* <pre style={{position:'absolute',bottom:0,left:0,fontSize:10,background:'rgba(255,255,255,0.6)'}}>{JSON.stringify(catalog,null,2)}</pre> */}
    </div>
  );
}