import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { GoogleMap, Polygon, Marker, useJsApiLoader } from '@react-google-maps/api';
import Constants from 'expo-constants';
import * as Location from 'expo-location';

/*
NewTemplateCreator
------------------
Allows admin (username==='admin') to draw a custom shape that becomes a reusable template.
User clicks to add vertices (lat/lng). On Save:
  1. Compute centroid.
  2. Convert absolute vertices into normalized unit baseVertices relative to centroid and scaled by max deltas in degrees.
  3. Persist to Templates table via new API (CreateTemplate) -- implemented now.
Normalized baseVertices allow later scaling by radius.
*/

const FUNCTION_BASE = 'https://draw-n-go.azurewebsites.net/api';

export default function NewTemplateCreator({ onClose, onSaved, navigation }) {
  const [vertices, setVertices] = useState([]);
  const [center, setCenter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [namePrompt, setNamePrompt] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const mapRef = useRef(null);
  const onMapLoad = useCallback(m => { mapRef.current = m; }, []);

  const apiKey = Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: apiKey });

  const handleClick = useCallback(e => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setVertices(prev => [...prev, { lat, lng }]);
    if (!center) setCenter({ lat, lng });
  }, [center]);

  const removeLast = useCallback(() => {
    setVertices(v => v.slice(0, -1));
  }, []);

  const clearAll = useCallback(() => {
    // Clear vertices but keep current center & zoom
    setVertices([]);
  }, []);

  const polygon = vertices.length >= 3 ? (
    <Polygon paths={vertices} options={{ strokeColor: '#21a4d6', fillOpacity: 0, strokeWeight: 2 }} />
  ) : null;

  const centroid = useMemo(() => {
    if (vertices.length < 3) return null;
    const lat = vertices.reduce((a,b)=>a+b.lat,0)/vertices.length;
    const lng = vertices.reduce((a,b)=>a+b.lng,0)/vertices.length;
    return { lat, lng };
  }, [vertices]);

  const normalizedBase = useMemo(() => {
    if (vertices.length < 3) return [];
    const c = centroid || center;
    if (!c) return [];
    // Compute max deltas for scaling (avoid extremely small denominators)
    let maxLatDelta = 0; let maxLngDelta = 0;
    vertices.forEach(v => {
      maxLatDelta = Math.max(maxLatDelta, Math.abs(v.lat - c.lat));
      maxLngDelta = Math.max(maxLngDelta, Math.abs(v.lng - c.lng));
    });
    if (maxLatDelta === 0 || maxLngDelta === 0) return [];
    return vertices.map(v => ({
      x: (v.lng - c.lng) / maxLngDelta,
      y: (v.lat - c.lat) / maxLatDelta,
    }));
  }, [vertices, centroid, center]);

  const handleInitiateSave = useCallback(() => {
    if (vertices.length < 3) { setError('Need at least 3 points'); return; }
    setNamePrompt(true);
  }, [vertices]);

  const handleSave = useCallback(async () => {
    if (!templateName || !/^[a-z0-9_-]+$/i.test(templateName)) {
      setError('Enter a valid template name (alphanumeric, dash, underscore)');
      return;
    }
    if (normalizedBase.length < 3) { setError('Normalization failed'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${FUNCTION_BASE}/CreateTemplate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: templateName, baseVertices: normalizedBase })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed');
      }
      setSuccess('Saved');
      setTimeout(() => {
        if (onSaved) { onSaved(); }
        else if (navigation) { navigation.goBack(); }
      }, 500);
    } catch (e) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [templateName, normalizedBase, onSaved, navigation]);

  const handleVertexDrag = useCallback((index, e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setVertices(prev => prev.map((p,i)=> i===index ? { lat, lng } : p));
  }, []);

  // Acquire user location for initial center & zoom
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const { coords } = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setCenter({ lat: coords.latitude, lng: coords.longitude });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!isLoaded) return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Loading map…</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      {/* Top-right controls overlay (styled similarly to AdminTemplateMap) */}
      <View style={{ position:'absolute', top:12, right:12, zIndex:10, display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', maxWidth:300 }}>
        <div style={{ display:'flex', flexDirection:'row', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button
            onClick={() => { if (onClose) { onClose(); } else if (navigation) { navigation.goBack(); } }}
            disabled={saving}
            style={{ background:'#d9534f', color:'#fff', padding:'6px 10px', border:'none', borderRadius:8, fontWeight:600, cursor:saving?'not-allowed':'pointer' }}
          >Cancel</button>
          <button
            onClick={handleInitiateSave}
            disabled={saving || vertices.length < 3}
            style={{ background: vertices.length<3? '#ccc':'#20b265', color:'#fff', padding:'6px 10px', border:'none', borderRadius:8, fontWeight:600, cursor:(saving || vertices.length<3)?'not-allowed':'pointer' }}
            title={vertices.length<3? 'Need at least 3 vertices':''}
          >Save</button>
          <button
            onClick={removeLast}
            disabled={!vertices.length}
            style={{ background: vertices.length? '#ff9800':'#ccc', color:'#fff', padding:'6px 10px', border:'none', borderRadius:8, fontWeight:600, cursor:vertices.length? 'pointer':'not-allowed' }}
            title="Undo last point"
          >Undo</button>
          <button
            onClick={clearAll}
            disabled={!vertices.length}
            style={{ background: vertices.length? '#555':'#ccc', color:'#fff', padding:'6px 10px', border:'none', borderRadius:8, fontWeight:600, cursor:vertices.length? 'pointer':'not-allowed' }}
            title="Clear all points"
          >Clear</button>
        </div>
        <span style={{ background:'rgba(255,255,255,0.9)', padding:'4px 8px', borderRadius:8, fontSize:12, fontWeight:600 }}>Vertices: {vertices.length}</span>
        {namePrompt && (
          <div style={{ background:'rgba(255,255,255,0.95)', padding:12, borderRadius:12, display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end' }}>
            <div style={{ display:'flex', flexDirection:'row', gap:8, alignItems:'center' }}>
              <label style={{ fontSize:12, fontWeight:600 }}>Template name:</label>
              <input
                style={{ padding:6, border:'1px solid #21a4d6', borderRadius:6, width:160 }}
                value={templateName}
                onChange={e=>setTemplateName(e.target.value)}
                placeholder="e.g. heart"
                disabled={saving}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background:saving? '#ccc':'#21a4d6', color:'#fff', padding:'6px 10px', border:'none', borderRadius:8, fontWeight:600, cursor:saving? 'not-allowed':'pointer' }}
              >{saving? 'Saving…':'Confirm'}</button>
            </div>
            {error && <span style={{ color:'red', fontSize:12 }}>{error}</span>}
            {success && <span style={{ color:'#20b265', fontSize:12 }}>{success}</span>}
          </div>
        )}
        {!namePrompt && error && <span style={{ background:'rgba(255,255,255,0.95)', padding:'4px 8px', borderRadius:8, fontSize:12, color:'red' }}>{error}</span>}
        {!namePrompt && success && <span style={{ background:'rgba(255,255,255,0.95)', padding:'4px 8px', borderRadius:8, fontSize:12, color:'#20b265' }}>{success}</span>}
      </View>
      <GoogleMap
        mapContainerStyle={{ height:'100%', width:'100%' }}
        center={center || { lat: 0, lng: 0 }}
        zoom={center ? 17 : 2}
        onClick={handleClick}
        onLoad={onMapLoad}
        options={{ disableDefaultUI: true }}
      >
        {polygon}
        {vertices.map((v,i)=>(
          <Marker
            key={i}
            position={v}
            draggable
            onDragEnd={(e)=>handleVertexDrag(i,e)}
            icon={window.google && window.google.maps ? {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 5,
              fillColor: '#21a4d6',
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#fff'
            } : undefined}
          />
        ))}
      </GoogleMap>
    </View>
  );
}
