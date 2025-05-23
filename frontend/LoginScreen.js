import React, { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  ScrollView,
  View
} from 'react-native';
import styles from './styles';
import logo from '../assets/logo.png';

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (username.length < 3 || password.length < 4) {
      setErrorMessage('Username must be at least 3 characters and password at least 4.');
      return;
    }

    try {
      const response = await fetch('https://draw-and-go.azurewebsites.net/api/login?', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const text = await response.text();
      if (response.status === 200) {
        setSuccessMessage('Login successful!');
        navigation.navigate('Main');
      } else {
        setErrorMessage(text);
      }
    } catch (err) {
      setErrorMessage('Could not connect to server.');
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
            placeholder="Username"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
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

          {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}
          {successMessage !== '' && <Text style={styles.success}>{successMessage}</Text>}

          <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.linkText}>Don’t have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
