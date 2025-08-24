import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import styles from './styles';
import SharedHeader from './SharedHeader';
// Drawing feature removed

const FUNCTION_APP_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const PlayerPage = ({ route, navigation }) => {
  const { username } = route.params || {};
  const displayName = username || 'Unknown';
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;
  // No drawing modal/state

  // Fetch latest games for the player
  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        if (!username) {
          setGames([]);
          setTotal(0);
          return;
        }
        const response = await fetch(`${FUNCTION_APP_ENDPOINT}/api/GetPlayerGames?username=${encodeURIComponent(username)}&page=${page}&pageSize=${pageSize}`);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
          setTotal(data.total || 0);
        } else {
          setGames([]); setTotal(0);
        }
      } catch (err) {
        setGames([]); setTotal(0);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, [username, page]);

  const handleLogout = () => {
    // Clear any auth/session data here if needed
    navigation.replace('Entrance');
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '92%', maxWidth: 820, height: '80%', backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#21a4d6' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Player Profile</Text>
              <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Close">
                <Text style={{ color: '#d9534f', fontWeight: 'bold', fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 16, flex: 1 }}>
            <Text style={styles.placeholderText}>Username: {displayName}</Text>
            <View style={{ marginTop: 16, flex: 1, overflow: Platform.OS === 'web' ? 'auto' : 'hidden' }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Latest Games:</Text>
              {loading ? (
                <ActivityIndicator size="large" color="#21a4d6" />
              ) : games.length === 0 ? (
                <Text style={{ color: '#888' }}>No games found.</Text>
              ) : (
                <>
                  <FlatList
                    data={games}
                    keyExtractor={item => item.gameId}
                    renderItem={({ item }) => (
                      <View style={{
                        backgroundColor: '#fff',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                        shadowColor: '#000',
                        shadowOpacity: 0.05,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                        borderWidth: 1,
                        borderColor: '#eee'
                      }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontWeight: 'bold', color: '#21a4d6', marginRight: 8 }} numberOfLines={1}>
                            {item.templateName || item.templateId || 'Template'}
                          </Text>
                          <Text style={{ color: '#f88a3b', fontWeight: 'bold' }}>
                            Duration: {item.timePlayedSec != null ? `${item.timePlayedSec}s` : '—'}
                          </Text>
                        </View>
                        <Text style={{ color: '#333' }}>Role: {item.role}</Text>
                        {item.role === 'Brush' && item.accuracy != null && (
                          <Text style={{ color: '#333' }}>Your Accuracy: {item.accuracy}%</Text>
                        )}
                        {item.totalAccuracy != null && (
                          <Text style={{ color: '#333' }}>Team Accuracy: {item.totalAccuracy}%</Text>
                        )}
                        {item.finalScore != null && (
                          <Text style={{ color: '#333' }}>Team Points: {item.finalScore}</Text>
                        )}
                        <Text style={{ color: '#888', marginTop: 4, fontSize: 12 }}>Game ID: {item.gameId} · Date: {item.date}</Text>
                      </View>
                    )}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 24 }}
                  />
                  {/* Pagination controls */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      style={[styles.button, { opacity: page <= 1 ? 0.5 : 1, paddingVertical: 8, paddingHorizontal: 12 }]}>
                      <Text style={styles.buttonText}>Prev</Text>
                    </TouchableOpacity>
                    <Text style={{ color: '#333' }}>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</Text>
                    <TouchableOpacity
                      onPress={() => setPage(p => (p < Math.ceil(total / pageSize) ? p + 1 : p))}
                      disabled={page >= Math.ceil(total / pageSize)}
                      style={[styles.button, { opacity: page >= Math.ceil(total / pageSize) ? 0.5 : 1, paddingVertical: 8, paddingHorizontal: 12 }]}>
                      <Text style={styles.buttonText}>Next</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            {/* Footer close removed; use top-right X */}
          </View>
        </SafeAreaView>
      </View>
  {/* Drawing modal removed */}
    </View>
  );
};

export default PlayerPage;