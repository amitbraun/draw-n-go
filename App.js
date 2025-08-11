import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import * as SignalR from '@microsoft/signalr';
import { v4 as uuidv4 } from 'uuid';
import EntranceScreen from './frontend/EntranceScreen';
import MainScreen from './frontend/MainScreen';
import LoginScreen from './frontend/LoginScreen.js';
import SignupScreen from './frontend/SignupScreen';
import WaitingRoom from './frontend/WaitingRoom';
import GameScreen from './frontend/GameScreen';
import PlayerPage from './frontend/PlayerPage';

const Stack = createNativeStackNavigator();
let clientId = uuidv4();

export default function App() {
  const [authState, setAuthState] = useState(null); // "login", "signup", "authenticated"
  const [authMode, setAuthMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState(null); // "brush" or "painter"
  const [connection, setConnection] = useState(null);
  const [brushLocation, setBrushLocation] = useState(null);
  const [brushTrail, setBrushTrail] = useState([]);
  const [allBrushes, setAllBrushes] = useState({});
  
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Entrance" screenOptions={{ presentation: 'card' }}>
        <Stack.Screen
          name="Entrance"
          component={EntranceScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Main" options={{ headerShown: false }}>
          {props => (
            <MainScreen
              {...props}
              username={username}
              setUsername={setUsername}
            />
          )}
        </Stack.Screen>
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
        />
        <Stack.Screen 
        name="Signup" 
        component={SignupScreen} 
        />
        <Stack.Screen
          name="WaitingRoom"
          component={WaitingRoom}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Game"
          component={GameScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PlayerPage"
          component={PlayerPage}
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' }
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
