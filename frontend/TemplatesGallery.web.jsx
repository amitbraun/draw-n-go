import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
// Removed Google Maps preview; using lightweight SVG polygons instead
import SharedHeader from './SharedHeader';
import { useFocusEffect } from '@react-navigation/native';

/*
TemplatesGallery
Shows cards for every template from GetTemplates.
Each card renders a lightweight SVG polygon derived from normalized baseVertices (no map for performance).
Admins also see a button to create a new template (navigates to CreateTemplate screen).
*/

const CARD_SIZE = 140; // px square for preview polygon
const NAME_BAR_HEIGHT = 30; // extra vertical space for name below shape
const PADDING = 10;

function TemplatePreview({ template, isAdmin, onDelete }) {
  const pointsAttr = useMemo(() => {
    if (!template?.baseVertices || !Array.isArray(template.baseVertices) || template.baseVertices.length < 3) return '';
    // Determine bounds (though normalization should already be around -1..1)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    template.baseVertices.forEach(p => {
      const x = p.x || 0; const y = p.y || 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    });
    if (!isFinite(minX) || !isFinite(maxX) || !isFinite(minY) || !isFinite(maxY)) return '';
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = (CARD_SIZE - 2 * PADDING) / Math.max(rangeX, rangeY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    return template.baseVertices.map(p => {
      const x = ((p.x || 0) - midX) * scale + CARD_SIZE / 2;
      const y = CARD_SIZE / 2 - ((p.y || 0) - midY) * scale; // invert y for visual consistency
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [template]);

  const [hover, setHover] = React.useState(false);
  const deletable = isAdmin && template.isCustom;
  return (
    <View
      style={{ width: CARD_SIZE, height: CARD_SIZE + NAME_BAR_HEIGHT, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff', overflow:'hidden', alignItems:'center', justifyContent:'flex-start', position:'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <View style={{ width: CARD_SIZE, height: CARD_SIZE, alignItems:'center', justifyContent:'center', position:'relative' }}>
        {pointsAttr ? (
          <svg width={CARD_SIZE} height={CARD_SIZE} style={{ position:'absolute', top:0, left:0 }}>
            <polygon points={pointsAttr} fill="none" stroke="#21a4d6" strokeWidth={2} />
          </svg>
        ) : (
          <Text style={{ fontSize:12, color:'#666' }}>No shape</Text>
        )}
        {deletable && hover && (
          <TouchableOpacity
            onPress={() => onDelete?.(template.templateId)}
            style={{ position:'absolute', top:6, right:6, backgroundColor:'rgba(217,83,79,0.9)', paddingHorizontal:8, paddingVertical:4, borderRadius:6 }}
          >
            <Text style={{ color:'#fff', fontSize:11, fontWeight:'600' }}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ height: NAME_BAR_HEIGHT, width: '100%', borderTopWidth:1, borderTopColor:'#eee', alignItems:'center', justifyContent:'center', paddingHorizontal:4 }}>
        <Text numberOfLines={1} style={{ fontSize:12, fontWeight:'600', color:'#333' }}>{template.templateId}</Text>
      </View>
    </View>
  );
}

export default function TemplatesGallery({ navigation, route }) {
  const username = route?.params?.username;
  const isAdmin = username === 'admin';
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('https://draw-n-go.azurewebsites.net/api/GetTemplates?t=' + Date.now(), { cache:'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh whenever screen gains focus (including after returning from CreateTemplate)
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => { if (active) await fetchTemplates(); })();
    return () => { active = false; };
  }, [fetchTemplates]));

  return (
    <View style={{ flex:1 }}>
      <SharedHeader navigation={navigation} username={username} />
      <View style={{ flex:1, padding:16 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <Text style={{ fontSize:20, fontWeight:'700', color:'#333' }}>Templates</Text>
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            {isAdmin && (
              <TouchableOpacity onPress={() => navigation.navigate('CreateTemplate', { username })} style={{ backgroundColor:'#21a4d6', paddingHorizontal:14, paddingVertical:8, borderRadius:8, marginRight:8 }}>
                <Text style={{ color:'#fff', fontWeight:'600' }}>Create</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                if (navigation.canGoBack()) navigation.goBack();
                else navigation.navigate('Main', { username });
              }}
              style={{ backgroundColor:'#888', paddingHorizontal:14, paddingVertical:8, borderRadius:8 }}>
              <Text style={{ color:'#fff', fontWeight:'600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
        {loading && <Text style={{ color:'#666' }}>Loading templates…</Text>}
        {error ? <Text style={{ color:'red' }}>{error}</Text> : null}
        <View style={{ flexDirection:'row', flexWrap:'wrap', gap:16 }}>
          {templates.map(t => (
            <TemplatePreview
              key={t.templateId}
              template={t}
              isAdmin={isAdmin}
              onDelete={async (id) => {
                if (!window.confirm(`Delete template '${id}'?`)) return;
                try {
                  const res = await fetch(`https://draw-n-go.azurewebsites.net/api/DeleteTemplate?templateId=${encodeURIComponent(id)}`, { method:'DELETE' });
                  if (!res.ok) throw new Error(await res.text());
                  setTemplates(prev => prev.filter(tp => tp.templateId !== id));
                } catch (e) {
                  alert(e.message || 'Delete failed');
                }
              }}
            />
          ))}
          {!loading && templates.length === 0 && !error && (
            <Text style={{ color:'#666' }}>No templates found.</Text>
          )}
        </View>
      </View>
    </View>
  );
}
