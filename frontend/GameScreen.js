import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import * as Location from 'expo-location';
import * as SignalR from '@microsoft/signalr';
import styles from './styles';

const SIGNALR_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const GameScreen = ({ route, navigation }) => {
  const {
    sessionId,
    gameId,
    users = [],
    painter,
    roles = {},
    username,
    isAdmin
  } = route.params || {};

  // Defensive: check if roles and username are valid
  const userRole = roles && username && roles[username] ? roles[username] : "Unknown";

  // Optionally, show a warning if roles or username are missing
  if (!roles || !username) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ color: 'red', textAlign: 'center', marginTop: 40 }}>
          Game data missing or corrupted. Please return to the main screen.
        </Text>
      </SafeAreaView>
    );
  }

  const isPainter = roles[username] === "Painter";
  const [location, setLocation] = useState(null);
  const [trails, setTrails] = useState({}); // { username: [ {latitude, longitude}, ... ] }
  const [ending, setEnding] = useState(false);
  const connectionRef = useRef(null);

  // Helper to send location to backend
  const sendLocation = async (coords) => {
    try {
      await fetch(`${SIGNALR_ENDPOINT}/api/sendLocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          username,
          latitude: coords.latitude,
          longitude: coords.longitude,
          timestamp: Date.now(),
        }),
      });
    } catch (err) {
      // Optionally handle error
    }
  };

  // Get location and send periodically
  useEffect(() => {
    let interval;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      sendLocation(loc.coords);
      interval = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
        sendLocation(loc.coords);
      }, 3000);
    })();
    return () => interval && clearInterval(interval);
  }, []);

  // SignalR connection for receiving locations
  useEffect(() => {
    const connection = new SignalR.HubConnectionBuilder()
      .withUrl(`${SIGNALR_ENDPOINT}/api`)
      .withAutomaticReconnect()
      .build();

    connection.on('receiveLocation', (sender, data) => {
      if (data.sessionId !== sessionId) return;
      setTrails(prev => {
        const prevTrail = prev[data.username] || [];
        // Only add if new
        if (
          prevTrail.length === 0 ||
          prevTrail[prevTrail.length - 1].latitude !== data.latitude ||
          prevTrail[prevTrail.length - 1].longitude !== data.longitude
        ) {
          return {
            ...prev,
            [data.username]: [...prevTrail, { latitude: data.latitude, longitude: data.longitude }]
          };
        }
        return prev;
      });
    });

    connection.start();
    connectionRef.current = connection;
    return () => {
      connection.stop();
    };
  }, [sessionId]);

  // Poll session to detect if game ended (for all users)
  useEffect(() => {
    if (ending) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `https://draw-n-go.azurewebsites.net/api/JoinSession?sessionId=${sessionId}`
        );
        if (response.ok) {
          const data = await response.json();
          if (!data.isStarted) {
            navigation.replace('WaitingRoom', { sessionId, username, isAdmin });
          }
        }
      } catch (e) {}
    }, 3000);
    return () => clearInterval(interval);
  }, [ending, sessionId, username, isAdmin, navigation]);

  // Admin ends the game
  const handleEndGame = async () => {
    setEnding(true);
    try {
      await fetch(`${SIGNALR_ENDPOINT}/api/StartGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, endGame: true }),
      });
      // Optionally, navigate admin immediately
      navigation.replace('WaitingRoom', { sessionId, username, isAdmin });
    } catch (err) {
      setEnding(false);
    }
  };

  // What to show
  const visibleUsers = isPainter ? users : [username];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Game Screen</Text>
        <Text style={styles.placeholderText}>Session ID: {sessionId}</Text>
        <Text style={styles.placeholderText}>
          You are: <Text style={{ fontWeight: 'bold' }}>{userRole}</Text>
        </Text>
      </View>
      <View style={{ margin: 20 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Players & Roles:</Text>
        <FlatList
          data={users}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <Text style={item === username ? { fontWeight: 'bold' } : {}}>
              {item} - {roles[item]}
              {item === users[0] ? ' 👑' : ''}
            </Text>
          )}
        />
      </View>
      <View style={{
        flex: 1,
        margin: 20,
        borderWidth: 2,
        borderColor: '#21a4d6',
        borderRadius: 12,
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        backgroundColor: '#f0f8ff',
        padding: 12,
      }}>
        <Text style={{ color: '#21a4d6', fontSize: 18, marginBottom: 8 }}>
          {isPainter
            ? "All Players' Locations & Trails"
            : "Your Location & Trail"}
        </Text>
        {visibleUsers.map(user => (
          <View key={user} style={{ marginBottom: 10 }}>
            <Text style={{ fontWeight: 'bold', color: '#20b265' }}>{user}</Text>
            <FlatList
              data={trails[user] || []}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item, index }) => (
                <Text style={{ fontSize: 12 }}>
                  {index + 1}. Lat: {item.latitude.toFixed(5)}, Lon: {item.longitude.toFixed(5)}
                </Text>
              )}
            />
          </View>
        ))}
      </View>
      {isAdmin && (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#d9534f', alignSelf: 'center', marginBottom: 20 }]}
          onPress={handleEndGame}
          disabled={ending}
        >
          <Text style={styles.buttonText}>End Game</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default GameScreen;
