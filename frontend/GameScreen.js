import React, { useEffect, useState, useRef } from 'react';
import { View, Text, SafeAreaView, FlatList } from 'react-native';
import * as Location from 'expo-location';
import * as SignalR from '@microsoft/signalr';
import styles from './styles';

const SIGNALR_ENDPOINT = 'https://draw-and-go.azurewebsites.net';

const GameScreen = ({ route }) => {
  const { sessionId, username, users, painter, roles } = route.params;
  const isPainter = roles[username] === "Painter";
  const [location, setLocation] = useState(null);
  const [trails, setTrails] = useState({}); // { username: [ {latitude, longitude}, ... ] }
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

  // What to show
  const visibleUsers = isPainter ? users : [username];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.middlePlaceholder}>
        <Text style={styles.title}>Game Screen</Text>
        <Text style={styles.placeholderText}>Session ID: {sessionId}</Text>
        <Text style={styles.placeholderText}>
          You are: <Text style={{ fontWeight: 'bold' }}>{roles[username]}</Text>
        </Text>
      </View>
      <View style={{ margin: 20 }}>
        <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Players & Roles:</Text>
        <FlatList
          data={users}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <Text>
              {item} - {roles[item]}{item === painter ? ' 👑' : ''}
              {item === username ? ' (you)' : ''}
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
    </SafeAreaView>
  );
};

export default GameScreen;
