import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import styles from './styles';

const FUNCTION_APP_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const HighScoresPage = ({ route, navigation }) => {
  // username param unused; drawing feature removed
  const [templateOptions, setTemplateOptions] = useState([{ id: 'all', name: 'All Templates' }]);
  const [selectedTemplate, setSelectedTemplate] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  // No drawing UI

  useEffect(() => {
    // Load template options from Templates table via GetTemplates
    (async () => {
      try {
        const res = await fetch(`${FUNCTION_APP_ENDPOINT}/api/GetTemplates`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (Array.isArray(data.templates) ? data.templates : []);
          let opts = [{ id: 'all', name: 'All Templates' }].concat(
            arr.map(t => ({
              id: t.templateId || t.RowKey || t.id,
              name: t.displayName || t.name || (t.templateId ? (t.templateId.charAt(0).toUpperCase() + t.templateId.slice(1)) : 'Template')
            }))
          );
          // Ensure Polygon appears even if not stored in Templates table
          if (!opts.some(o => o.id === 'polygon')) {
            opts.push({ id: 'polygon', name: 'Polygon' });
          }
          setTemplateOptions(opts);
        }
      } catch {
        // Fallback options include Polygon
        setTemplateOptions(prev => (prev.some(o => o.id === 'polygon') ? prev : [...prev, { id: 'polygon', name: 'Polygon' }]));
      }
    })();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (selectedTemplate && selectedTemplate !== 'all') params.append('templateId', selectedTemplate);
        const res = await fetch(`${FUNCTION_APP_ENDPOINT}/api/GetHighScores?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const arr = Array.isArray(data) ? data : (Array.isArray(data.games) ? data.games : []);
          setRows(arr);
          setTotal((typeof data.total === 'number') ? data.total : arr.length);
        } else { setRows([]); setTotal(0); }
      } catch { setRows([]); setTotal(0); }
      setLoading(false);
    };
    load();
  }, [selectedTemplate, page]);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '92%', maxWidth: 820, height: '80%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#21a4d6' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Global Hi-Scores</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#fff', marginRight: 8 }}>Template:</Text>
                <select
                  value={selectedTemplate}
                  onChange={(e) => { setPage(1); setSelectedTemplate(e.target.value); }}
                  style={{ padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#fff', backgroundColor: '#fff', minWidth: 180, marginRight: 12 }}
                >
                  {templateOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
                  <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Close">
                    <Text style={{ color: '#d9534f', fontWeight: 'bold', fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 16, flex: 1, overflow: Platform.OS === 'web' ? 'auto' : 'hidden' }}>
            {loading ? (
              <ActivityIndicator size="large" color="#21a4d6" />
            ) : rows.length === 0 ? (
              <Text style={{ color: '#888' }}>No results.</Text>
            ) : (
              <>
                <FlatList
                  data={rows}
                  keyExtractor={(item, idx) => item.gameId || String(idx)}
                  renderItem={({ item }) => (
                    <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eee', elevation: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontWeight: 'bold', color: '#21a4d6', marginRight: 8 }} numberOfLines={1}>
                          {item.templateName || item.templateId || 'Template'}
                        </Text>
                        <Text style={{ color: '#f88a3b', fontWeight: 'bold' }}>
                          Team Points: {item.finalScore != null ? item.finalScore : '—'}
                        </Text>
                      </View>
                      {item.totalAccuracy != null && (
                        <Text style={{ color: '#333' }}>Team Accuracy: {item.totalAccuracy}%</Text>
                      )}
                      <View style={{ marginTop: 6 }}>
                        <Text style={{ fontWeight: '600', marginBottom: 4 }}>Players</Text>
                        {(item.players || []).map((p, i) => (
                          <Text key={i} style={{ color: '#333' }}>
                            {p.username} — {p.role}{p.role === 'Brush' && p.accuracy != null ? ` (accuracy ${p.accuracy}%)` : ''}
                          </Text>
                        ))}
                      </View>
                      <Text style={{ color: '#888', marginTop: 6, fontSize: 12 }}>Game ID: {item.gameId} · Date: {item.date} · Duration: {item.timePlayedSec != null ? `${item.timePlayedSec}s` : '—'}</Text>
                      {/* Drawing feature removed */}
                    </View>
                  )}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 24 }}
                    ListFooterComponent={(
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                        <TouchableOpacity onPress={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={[styles.button, { opacity: page <= 1 ? 0.5 : 1, paddingVertical: 8, paddingHorizontal: 12 }]}>
                          <Text style={styles.buttonText}>Prev</Text>
                        </TouchableOpacity>
                        <Text style={{ color: '#333' }}>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</Text>
                        <TouchableOpacity onPress={() => setPage(p => (p < Math.ceil(total / pageSize) ? p + 1 : p))} disabled={page >= Math.ceil(total / pageSize)} style={[styles.button, { opacity: page >= Math.ceil(total / pageSize) ? 0.5 : 1, paddingVertical: 8, paddingHorizontal: 12 }]}>
                          <Text style={styles.buttonText}>Next</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                />
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
  {/* Drawing modal removed */}
    </View>
  );
};

export default HighScoresPage;
