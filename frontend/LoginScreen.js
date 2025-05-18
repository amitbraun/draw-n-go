import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  SafeAreaView,
  ScrollView,
  View
} from 'react-native';
import styles from './styles';
import logo from '../assets/logo.png';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (email.length < 3 || password.length < 4) {
        Alert.alert('Invalid Input', 'Email must be at least 3 chars, password at least 4.');
        return;
    }

    try {
        const response = { ok: true, json: async () => ({ success: true }) };

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
        }

        const result = await response.json();
        if (result.success) {
        navigation.navigate('Main');
        } else {
        Alert.alert('Login Failed', result.message || 'Invalid credentials');
        }
    } catch (error) {
        Alert.alert('Error', error.message);
    }
    };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>Login</Text>
          <Image source={logo} style={styles.titleIcon} resizeMode="contain" />
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Welcome Back!</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.linkText}>Don’t have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
