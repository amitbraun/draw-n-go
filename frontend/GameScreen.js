import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import styles from './styles';
import PainterMap from './PainterMap.web.jsx';
import { scoreWalkVsTemplate } from './ScoreCalculator';
import ResultsModal from './ResultsModal';

const FUNCTION_APP_ENDPOINT = 'https://draw-n-go.azurewebsites.net';

const colorPalette = [
  '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9A6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];
const hashColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colorPalette[Math.abs(hash) % colorPalette.length];
};

const GameScreen = ({ route, navigation }) => {
  const { sessionId, gameId, users = [], roles = {}, username, isAdmin, template = null, gameStartTime } = route.params || {};

  // Identify painter user
  const painterUser = useMemo(() => {
    try {
      return Object.keys(roles || {}).find(u => roles[u] === 'Painter');
    } catch { return undefined; }
  }, [roles]);

  if (!roles || !username) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ color: 'red', textAlign: 'center', marginTop: 40 }}>
          Game data missing or corrupted. Please return to the main screen.
        </Text>
      </SafeAreaView>
    );
  }

  const isPainter = roles[username] === 'Painter';
  const isBrush = roles[username] === 'Brush';

  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  const [trails, setTrails] = useState({}); // { user: [{lat,lng},...] }
  const [latestPositions, setLatestPositions] = useState({}); // { user: { latitude, longitude } }
  const [ending, setEnding] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [results, setResults] = useState([]);
  const [calculating, setCalculating] = useState(false);

  // Deterministic colors for users (no color for painter)
  const playerColors = useMemo(() => {
    const out = {};
    users.forEach(u => { if (roles[u] !== 'Painter') out[u] = hashColor(u); });
    return out;
  }, [users, roles]);

  // Timer: elapsed since gameStartTime or mount
  useEffect(() => {
    const start = gameStartTime || Date.now();
    timerRef.current = setInterval(() => setTimer(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timerRef.current);
  }, [gameStartTime]);

  // Brushes: high-accuracy watch so every meter counts, send immediately and on updates
  useEffect(() => {
    if (!isBrush) return;
    let sub;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const loc0 = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        await fetch(`${FUNCTION_APP_ENDPOINT}/api/sendLocation`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, gameId, location: { latitude: loc0.coords.latitude, longitude: loc0.coords.longitude, timestamp: Date.now() } })
        });
      } catch {}
      try {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1, // 1m granularity
            timeInterval: 500,   // was 1000ms -> 500ms for higher temporal resolution
          },
          async (loc) => {
            try {
              await fetch(`${FUNCTION_APP_ENDPOINT}/api/sendLocation`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  username, gameId,
                  location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude, timestamp: Date.now() }
                })
              });
            } catch {}
          }
        );
      } catch {}
    })();
    return () => { try { sub && sub.remove(); } catch {} };
  }, [isBrush, username, gameId]);

  // On mount (painter): seed trails once with initial locations so dots appear immediately
  useEffect(() => {
    if (!isPainter) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${FUNCTION_APP_ENDPOINT}/api/getLocations?gameId=${gameId}`);
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setTrails(prev => {
            const next = { ...prev };
            // For all players except painter, ensure at least one point
            users.forEach(u => {
              if (roles[u] === 'Painter') return;
              const existing = next[u] || [];
              // Try to find location from API
              const d = data.find(x => x.username === u);
              if (d && d.latitude != null && d.longitude != null) {
                // Add point even if duplicate
                next[u] = [...existing, { latitude: d.latitude, longitude: d.longitude }];
              } else if (!existing.length && latestPositions[u]) {
                next[u] = [{ latitude: latestPositions[u].latitude, longitude: latestPositions[u].longitude }];
              } else if (!existing.length) {
                // No data yet: keep empty; the poll below will fill as soon as available
                next[u] = [];
              }
            });
            return next;
          });
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [isPainter, gameId, users, roles]);

  // Painter polls locations from Distances and builds local trails
  useEffect(() => {
    if (!isPainter) return;
    let interval;
    const poll = async () => {
      try {
        const res = await fetch(`${FUNCTION_APP_ENDPOINT}/api/getLocations?gameId=${gameId}`);
        if (!res.ok) return;
        const data = await res.json();
        const latest = {};
        data.forEach(d => { if (d.latitude != null && d.longitude != null) { latest[d.username] = { latitude: d.latitude, longitude: d.longitude }; } });
        setLatestPositions(latest);
        setTrails(prev => {
          const next = { ...prev };
            users.forEach(u => {
              if (roles[u] === 'Painter') return;
              const d = data.find(x => x.username === u);
              const arr = next[u] || [];
              if (d && d.latitude != null && d.longitude != null) {
                next[u] = [...arr, { latitude: d.latitude, longitude: d.longitude }];
              } else if (arr.length === 0 && latest[u]) {
                next[u] = [{ latitude: latest[u].latitude, longitude: latest[u].longitude }];
              }
            });
          return next;
        });
      } catch {}
    };
    poll();
    interval = setInterval(poll, 300); // was 1000ms, then 500ms; now 300ms for smoother updates
    return () => clearInterval(interval);
  }, [isPainter, gameId, users, roles]);

  // Poll session end
  useEffect(() => {
    if (ending) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${FUNCTION_APP_ENDPOINT}/api/JoinSession?sessionId=${sessionId}&t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!data.isStarted) {
            navigation.replace('WaitingRoom', { sessionId, username, isAdmin, template: data.template || template || null });
          }
        }
      } catch {}
    }, 1000);
    return () => clearInterval(interval);
  }, [ending, sessionId, username, isAdmin, navigation, template]);

  const handleEndGame = async () => {
    setEnding(true);
    setShowResultsModal(true); // Show modal immediately
    setCalculating(true);      // Show loading state in modal
    let scoreResults = [];
    try {
      const endRes = await fetch(`${FUNCTION_APP_ENDPOINT}/api/StartGame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, endGame: true }),
      });
      // After ending, fetch fresh session (cache-busted) to capture template & state
      try {
        const res = await fetch(`${FUNCTION_APP_ENDPOINT}/api/JoinSession?sessionId=${sessionId}&t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          // Calculate scores for each player (dummy example, adapt as needed)
          scoreResults = (data.players || []).map(player => {
            // You need to provide playerLatLon, templateLatLon, elapsedSec for each player
            // Example:
            return {
              username: player.username,
              score: scoreWalkVsTemplate(player.latLon, data.template.latLon, player.elapsedSec).score
            };
          });
          setResults(scoreResults);
          setCalculating(false);
          // Do NOT auto-close modal; wait for user to close
          return;
        }
      } catch {}
      setCalculating(false);
    } catch {
      setCalculating(false);
      setEnding(false);
    }
  };

  // Full screen map with overlays
  return (
    <SafeAreaView style={[styles.safeArea, { flex: 1 }]}>
      {/* Results Modal */}
      <ResultsModal
        visible={showResultsModal}
        onClose={() => {
          setShowResultsModal(false);
          navigation.replace('WaitingRoom', {
            sessionId,
            username,
            isAdmin,
            template,
          });
        }}
        username={username}
        results={results}
        calculating={calculating}
      />
      <View style={{ flex: 1, position: 'relative' }}>
        {isPainter && template ? (
          <PainterMap
            template={template}
            height={"100%"}
            trails={trails}
            latestPositions={latestPositions}
            playerColors={playerColors}
            disableInteractions={true}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '600' }}>Game in progress…</Text>
            <Text style={{ marginTop: 6, color: '#666' }}>Please wait until the game ends.</Text>
          </View>
        )}
        {/* Top-left: players and roles with colors (no color dot for painter) */}
        {isPainter && (
          <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', padding: 10, borderRadius: 8, maxWidth: 260 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>Players</Text>
            {users.map(u => (
              <View key={u} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                {roles[u] !== 'Painter' && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: playerColors[u], marginRight: 6 }} />
                )}
                <Text style={{ fontWeight: u === username ? 'bold' : 'normal' }}>{u} - {roles[u]}</Text>
              </View>
            ))}
          </View>
        )}
        {/* Top-right: elapsed time only */}
        <View style={{ position: 'absolute', top: 12, right: 12, alignItems: 'flex-end' }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.92)', padding: 8, borderRadius: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#f88a3b' }}>Elapsed time: {timer}s</Text>
          </View>
        </View>
        {/* Bottom-left: end button (if admin or painter) */}
        {(isAdmin || isPainter) && (
          <View style={{ position: 'absolute', bottom: 16, left: 12 }}>
            <TouchableOpacity
              style={[styles.button, { paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#d9534f', minWidth: 120 }]}
              onPress={handleEndGame}
              disabled={ending}
            >
              <Text style={[styles.buttonText, { fontSize: 14 }]}>End Game</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default GameScreen;
