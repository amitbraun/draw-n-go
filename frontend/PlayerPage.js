import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import styles from './styles';
import SharedHeader from './SharedHeader';

const FUNCTION_APP_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const PlayerPage = ({ route, navigation }) => {
  const { username } = route.params || {};
  const displayName = username || 'Unknown';
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest games for the player
  useEffect(() => {
    const fetchGames = async () => {
      try {
        if (!username) {
          setGames([]);
          return;
        }
        const response = await fetch(`${FUNCTION_APP_ENDPOINT}/api/GetPlayerGames?username=${username}`);
        if (response.ok) {
          const data = await response.json();
          setGames(data.games || []);
        }
      } catch (err) {
        setGames([]);
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, [username]);

  const handleLogout = () => {
    // Clear any auth/session data here if needed
    navigation.replace('Entrance');
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '90%', maxWidth: 520, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
        <SafeAreaView>
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#21a4d6' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Player Profile</Text>
              <View style={{ width: 48 }} />
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <Text style={styles.placeholderText}>Username: {displayName}</Text>
            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Latest Games:</Text>
              {loading ? (
                <ActivityIndicator size="large" color="#21a4d6" />
              ) : games.length === 0 ? (
                <Text style={{ color: '#888' }}>No games found.</Text>
              ) : (
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
                      <Text style={{ fontWeight: 'bold', color: '#21a4d6' }}>Game ID: {item.gameId}</Text>
                      <Text>Date: {item.date}</Text>
                      <Text>Role: {item.role}</Text>
                      <Text>Result: {item.result}</Text>
                    </View>
                  )}
                />
              )}
            </View>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: '#d9534f', alignSelf: 'center', marginTop: 16 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

export default PlayerPage;