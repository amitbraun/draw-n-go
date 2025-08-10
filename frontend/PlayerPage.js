import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import styles from './styles';
import SharedHeader from './SharedHeader';

const FUNCTION_APP_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const PlayerPage = ({ route, navigation }) => {
  const { username } = route.params || {};
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest games for the player
  useEffect(() => {
    const fetchGames = async () => {
      try {
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
    <SafeAreaView style={styles.safeArea}>
      <SharedHeader navigation={navigation} showHome /> {/* Show Home button on PlayerPage */}
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Player Profile</Text>
        <Text style={styles.placeholderText}>Username: {username}</Text>
      </View>
      <View style={{ margin: 20 }}>
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
        style={[styles.button, { backgroundColor: '#d9534f', alignSelf: 'center', marginBottom: 20 }]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default PlayerPage;