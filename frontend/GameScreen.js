import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity, FlatList } from 'react-native';
import * as Location from 'expo-location';
import * as SignalR from '@microsoft/signalr';
import styles from './styles';
import SharedHeader from './SharedHeader';
import PainterMap from './PainterMap.web.jsx';

const FUNCTION_APP_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const GameScreen = ({ route, navigation }) => {
  const {
    sessionId,
    gameId,
    users = [],
    painter,
    roles = {},
    username,
    isAdmin,
    template = null,
    gameStartTime // Pass this from WaitingRoom/Game start if available
  } = route.params || {};

  const userRole = roles && username && roles[username] ? roles[username] : "Unknown";
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
  const isBrush = roles[username] === "Brush";
  const [location, setLocation] = useState(null);
  const [trails, setTrails] = useState({});
  const [ending, setEnding] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // Timer logic: count up from game start
  useEffect(() => {
    // Use gameStartTime from props if available, else fallback to Date.now() at mount
    const start = gameStartTime || Date.now();
    timerRef.current = setInterval(() => {
      setTimer(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [gameStartTime]);

  // Only Brushes send their location periodically
  useEffect(() => {
    if (!isBrush) return;
    let interval;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
      // sendLocation(loc.coords); // If needed for backend
      interval = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
        // sendLocation(loc.coords); // If needed for backend
      }, 3000);
    })();
    return () => interval && clearInterval(interval);
  }, [roles, username]);

  // Only the Painter polls for all locations
  useEffect(() => {
    if (!isPainter) return;
    let interval;
    const pollLocations = async () => {
      try {
        const res = await fetch(
          `${FUNCTION_APP_ENDPOINT}/api/getLocations?gameId=${gameId}`
        );
        if (res.ok) {
          const locations = await res.json();
          const newTrails = {};
          locations.forEach(loc => {
            newTrails[loc.username] = [
              ...(trails[loc.username] || []),
              { latitude: loc.latitude, longitude: loc.longitude }
            ];
          });
          setTrails(newTrails);
        }
      } catch (e) {}
    };
    interval = setInterval(pollLocations, 3000);
    pollLocations();
    return () => clearInterval(interval);
  }, [gameId, roles, username]);

  // Poll session to detect if game ended (for all users)
  useEffect(() => {
    if (ending) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${FUNCTION_APP_ENDPOINT}/api/JoinSession?sessionId=${sessionId}`
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
      await fetch(`${FUNCTION_APP_ENDPOINT}/api/StartGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, endGame: true }),
      });
      navigation.replace('WaitingRoom', { sessionId, username, isAdmin });
    } catch (err) {
      setEnding(false);
    }
  };

  // What to show
  const visibleUsers = isPainter ? users : [username];

  return (
    <SafeAreaView style={styles.safeArea}>
      <SharedHeader navigation={navigation} />
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Game Screen</Text>
        <Text style={styles.placeholderText}>Session ID: {sessionId}</Text>
        <Text style={styles.placeholderText}>
          You are: <Text style={{ fontWeight: 'bold' }}>{userRole}</Text>
        </Text>
        {template && template.templateId && (
          <Text style={[styles.placeholderText, { color: '#21a4d6', marginTop: 8 }]}>
            Chosen Shape: <Text style={{ fontWeight: 'bold' }}>
              {template.templateId.charAt(0).toUpperCase() + template.templateId.slice(1)}
            </Text>
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#f88a3b' }}>
          Timer: {timer}s
        </Text>
      </View>
      {/* Painter sees the map and timer, Brush sees only the timer */}
      {isPainter && template && (
        <PainterMap template={template} />
      )}
      {/* Hide all players location and trails box */}
      {isPainter && (
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
      )}
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
