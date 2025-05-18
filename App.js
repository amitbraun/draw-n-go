import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EntranceScreen from './frontend/EntranceScreen';
import MainScreen from './frontend/MainScreen';
import LoginScreen from './frontend/LoginScreen.js';
import SignupScreen from './frontend/SignupScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Entrance">
        <Stack.Screen
          name="Entrance"
          component={EntranceScreen} // ✅ Renders WITH navigation
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Main"
          component={MainScreen}
          options={{ title: 'Main Screen',
            headerShown: false }}

        />
        <Stack.Screen 
          name="Login" 
          component={LoginScreen} 
        />
        <Stack.Screen 
        name="Signup" 
        component={SignupScreen} 
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
